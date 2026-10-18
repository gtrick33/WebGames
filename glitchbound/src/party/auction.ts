/**
 * Name Your Price: a pure auction engine with fictional money. Budgets, collection limits, passing
 * and turn order are validated here, so the auction can never get stuck or let anyone overspend.
 * There is no real money anywhere in this mode.
 */
import type { AuctionItem } from './types';

export interface AuctionSettings {
  budget: number;
  limit: number;
  /** Smallest raise (and the opening bid). */
  increment: number;
  /** Items to auction. */
  rounds: number;
}

export interface AuctionPlayer {
  id: string;
  budget: number;
  items: { item: AuctionItem; paid: number }[];
}

export interface AuctionState {
  settings: AuctionSettings;
  players: AuctionPlayer[];
  queue: AuctionItem[];
  /** Index of the item being sold. */
  index: number;
  bid: number;
  leader: string | null;
  /** Players who passed on this item. */
  passed: string[];
  /** Whose decision it is. */
  active: string | null;
  phase: 'bidding' | 'sold' | 'unsold' | 'done';
  /** Rotates who opens each item. */
  opener: number;
  history: { item: string; winner: string | null; price: number }[];
}

export type AuctionAction = { type: 'bid'; amount?: number } | { type: 'pass' } | { type: 'next' };

const player = (s: AuctionState, id: string): AuctionPlayer => s.players.find((p) => p.id === id)!;

/** The lowest bid that is allowed right now. */
export const minBid = (s: AuctionState): number => (s.leader ? s.bid + s.settings.increment : s.settings.increment);

/** Whether a player may still bid on the current item. */
export function canBid(s: AuctionState, id: string): boolean {
  const p = player(s, id);
  return !s.passed.includes(id) && s.leader !== id && p.items.length < s.settings.limit && p.budget >= minBid(s);
}

/** The next player (after `fromIndex` in seat order) who can still bid, or null. */
function nextBidder(s: AuctionState, fromIndex: number): string | null {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const p = s.players[(fromIndex + k) % n]!;
    if (canBid(s, p.id)) return p.id;
  }
  return null;
}

/** Ends bidding when nobody else can raise: sold to the leader, or unsold if no one bid. */
function settle(s: AuctionState): AuctionState {
  const active = nextBidder(s, s.players.findIndex((p) => p.id === (s.active ?? s.leader ?? s.players[0]!.id)));
  if (active) return { ...s, active };
  const item = s.queue[s.index]!;
  if (!s.leader) return { ...s, active: null, phase: 'unsold', history: [...s.history, { item: item.id, winner: null, price: 0 }] };
  const players = s.players.map((p) => (p.id === s.leader ? { ...p, budget: p.budget - s.bid, items: [...p.items, { item, paid: s.bid }] } : p));
  return { ...s, players, active: null, phase: 'sold', history: [...s.history, { item: item.id, winner: s.leader, price: s.bid }] };
}

/** Whether anyone can still take part at all (space in their collection and money for an opening bid). */
const anyoneCanPlay = (players: AuctionPlayer[], st: AuctionSettings): boolean => players.some((p) => p.items.length < st.limit && p.budget >= st.increment);

function openItem(s: AuctionState, index: number, opener: number): AuctionState {
  if (index >= s.queue.length || index >= s.settings.rounds || !anyoneCanPlay(s.players, s.settings)) return { ...s, index, phase: 'done', active: null };
  const base: AuctionState = { ...s, index, bid: 0, leader: null, passed: [], phase: 'bidding', opener, active: null };
  const first = s.players[opener % s.players.length]!;
  const active = canBid(base, first.id) ? first.id : nextBidder(base, opener % s.players.length);
  return { ...base, active };
}

export function startAuction(settings: AuctionSettings, playerIds: string[], items: AuctionItem[]): AuctionState {
  const players = playerIds.map((id) => ({ id, budget: settings.budget, items: [] }));
  const s: AuctionState = { settings, players, queue: items, index: 0, bid: 0, leader: null, passed: [], active: null, phase: 'bidding', opener: 0, history: [] };
  return openItem(s, 0, 0);
}

export function reduceAuction(s: AuctionState, a: AuctionAction): AuctionState {
  if (a.type === 'next') {
    if (s.phase !== 'sold' && s.phase !== 'unsold') return s;
    return openItem(s, s.index + 1, s.opener + 1);
  }
  if (s.phase !== 'bidding' || !s.active) return s;
  const me = s.active;
  const at = s.players.findIndex((p) => p.id === me);
  if (a.type === 'pass') {
    return settle({ ...s, passed: [...s.passed, me] });
  }
  const amount = Math.floor(a.amount ?? minBid(s));
  if (!canBid(s, me) || amount < minBid(s) || amount > player(s, me).budget) return s;
  const next: AuctionState = { ...s, bid: amount, leader: me };
  const following = nextBidder(next, at);
  return following ? { ...next, active: following } : settle({ ...next, active: me });
}

export interface CollectionSummary {
  id: string;
  spent: number;
  left: number;
  items: number;
  rarity: number;
  themes: number;
}

export function summaries(s: AuctionState): CollectionSummary[] {
  return s.players.map((p) => ({
    id: p.id,
    spent: p.items.reduce((n, x) => n + x.paid, 0),
    left: p.budget,
    items: p.items.length,
    rarity: p.items.reduce((n, x) => n + x.item.rarity, 0),
    themes: new Set(p.items.map((x) => x.item.theme)).size,
  }));
}

/** Transparent, house-rule style awards (not claims about "real" value). */
export function auctionAwards(s: AuctionState): { title: string; playerId: string; why: string }[] {
  const sums = summaries(s);
  const top = <K extends keyof CollectionSummary>(k: K, dir: 1 | -1 = 1): CollectionSummary | null => {
    const sorted = [...sums].filter((x) => x.items > 0).sort((a, b) => dir * ((b[k] as number) - (a[k] as number)));
    return sorted[0] ?? null;
  };
  const out: { title: string; playerId: string; why: string }[] = [];
  const rare = top('rarity');
  if (rare) out.push({ title: 'Rarest Collection', playerId: rare.id, why: `${rare.rarity} rarity stars` });
  const diverse = top('themes');
  if (diverse && diverse.themes > 1) out.push({ title: 'Most Diverse', playerId: diverse.id, why: `${diverse.themes} different themes` });
  const saver = [...sums].sort((a, b) => b.left - a.left)[0];
  if (saver) out.push({ title: 'Penny Pincher', playerId: saver.id, why: `$${saver.left} left in the bank` });
  const big = [...s.history].filter((h) => h.winner).sort((a, b) => b.price - a.price)[0];
  if (big?.winner) out.push({ title: 'Big Spender', playerId: big.winner, why: `paid $${big.price} for ${s.queue.find((i) => i.id === big.item)?.name ?? 'one item'}` });
  return out;
}
