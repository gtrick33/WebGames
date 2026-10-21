/**
 * Belot: the rules, pure (no React, no DOM, no Math.random). One deal is a value; every move returns a
 * new one. The same code runs the single-player table, the computer players and the live room server.
 *
 * Seats 0-3 run counter-clockwise from the bottom of the screen (0 you, 1 right, 2 your partner at the
 * top, 3 left); "next" is (seat + 1) % 4. Teams: seat % 2 (0 = seats 0 and 2).
 *
 * Cards are numbers 0-31: suit * 8 + rank, ranks in sequence order 7 8 9 10 J Q K A (0-7).
 */

export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;
export type Card = number;
/** Suit index: 0 clubs, 1 diamonds, 2 hearts, 3 spades. */
export type Suit = 0 | 1 | 2 | 3;
/** Contracts in bidding order: four suits, then no trumps, then all trumps. */
export type Contract = 0 | 1 | 2 | 3 | 4 | 5;
export const NT: Contract = 4;
export const AT: Contract = 5;

export type Call = { k: 'pass' } | { k: 'bid'; c: Contract } | { k: 'double' } | { k: 'redouble' };

export const SUITS = ['♣', '♦', '♥', '♠'] as const;
export const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export const suitOf = (c: Card): Suit => (c >> 3) as Suit;
export const rankOf = (c: Card): number => c & 7;
export const cardOf = (s: Suit, r: number): Card => s * 8 + r;
export const teamOf = (s: Seat): Team => (s % 2) as Team;
export const next = (s: Seat, n = 1): Seat => ((s + n) % 4) as Seat;
export const cardName = (c: Card): string => `${RANKS[rankOf(c)]}${SUITS[suitOf(c)]}`;

/** Strength within a trump suit (J 9 A 10 K Q 8 7) and a plain suit (A 10 K Q J 9 8 7), by rank index. */
const TRUMP_STR = [0, 1, 6, 4, 7, 2, 3, 5];
const PLAIN_STR = [0, 1, 2, 6, 3, 4, 5, 7];
const TRUMP_PTS = [0, 0, 14, 10, 20, 3, 4, 11];
const PLAIN_PTS = [0, 0, 0, 10, 2, 3, 4, 11];

export const isTrump = (c: Card, k: Contract | null): boolean => k === AT || (k !== null && k < NT && suitOf(c) === k);
export const strength = (c: Card, k: Contract | null): number => (isTrump(c, k) ? TRUMP_STR : PLAIN_STR)[rankOf(c)]!;
export const points = (c: Card, k: Contract | null): number => (isTrump(c, k) ? TRUMP_PTS : PLAIN_PTS)[rankOf(c)]!;

// ---------------------------------------------------------------- random

/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same deal. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit seed for deal `n` of a match (a re-deal after four passes is its own number). */
export const dealSeed = (seed: number, n: number): number => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n + 1, 0xc2b2ae35)) >>> 0;

export function shuffled(seed: number): Card[] {
  const r = rng(seed);
  const d = Array.from({ length: 32 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

// ---------------------------------------------------------------- declarations

export type DeclKind = 'tierce' | 'quarte' | 'quint' | 'carre';
export interface Declaration {
  kind: DeclKind;
  points: number;
  /** Sequences: their highest card's rank and suit. Carrés: the rank. */
  rank: number;
  suit: Suit | null;
  cards: Card[];
}
export const DECL_NAME: Record<DeclKind, string> = { tierce: 'Tierce', quarte: 'Quarte', quint: 'Quint', carre: 'Carré' };
const CARRE_PTS: Record<number, number> = { 2: 150, 3: 100, 4: 200, 5: 100, 6: 100, 7: 100 };

function sequencesIn(cards: readonly Card[]): Declaration[] {
  const out: Declaration[] = [];
  for (let s = 0 as Suit; s < 4; s = (s + 1) as Suit) {
    const have = new Set(cards.filter((c) => suitOf(c) === s).map(rankOf));
    let r = 0;
    while (r < 8) {
      if (!have.has(r)) {
        r++;
        continue;
      }
      let end = r;
      while (have.has(end + 1)) end++;
      const len = end - r + 1;
      const run = (lo: number, hi: number, kind: DeclKind, pts: number): void => {
        out.push({ kind, points: pts, rank: hi, suit: s, cards: Array.from({ length: hi - lo + 1 }, (_, i) => cardOf(s, lo + i)) });
      };
      if (len >= 8) {
        run(end - 4, end, 'quint', 100);
        run(r, r + 2, 'tierce', 20);
      } else if (len >= 5) run(end - 4, end, 'quint', 100);
      else if (len === 4) run(r, end, 'quarte', 50);
      else if (len === 3) run(r, end, 'tierce', 20);
      r = end + 1;
    }
  }
  return out;
}

/**
 * The declarations a hand can make (none in no trumps): the carrés and sequences worth the most when
 * a card may serve only one of them.
 */
export function declarationsOf(hand: readonly Card[], k: Contract): Declaration[] {
  if (k === NT) return [];
  const carres: Declaration[] = [];
  for (const r of [2, 3, 4, 5, 6, 7]) {
    const cards = hand.filter((c) => rankOf(c) === r);
    if (cards.length === 4) carres.push({ kind: 'carre', points: CARRE_PTS[r]!, rank: r, suit: null, cards });
  }
  let best: Declaration[] = [];
  let bestPts = -1;
  for (let mask = 0; mask < 1 << carres.length; mask++) {
    const kept = carres.filter((_, i) => mask & (1 << i));
    const used = new Set(kept.flatMap((d) => d.cards));
    const seqs = sequencesIn(hand.filter((c) => !used.has(c)));
    const all = [...kept, ...seqs];
    const pts = all.reduce((n, d) => n + d.points, 0);
    if (pts > bestPts) {
      best = all;
      bestPts = pts;
    }
  }
  return best;
}

/** How a sequence compares: its kind, then its highest card. */
const seqKey = (d: Declaration): number => (d.kind === 'quint' ? 3 : d.kind === 'quarte' ? 2 : 1) * 10 + d.rank;
/** How a carré compares: like trumps (jacks, nines, aces, tens, kings, queens). */
const carreKey = (d: Declaration): number => TRUMP_STR[d.rank]!;

/**
 * Which declarations score, by team: only the team with the best sequence scores its sequences (an
 * equal best cancels them all), and the same for carrés, judged on their own.
 */
export function scoringDeclarations(declared: readonly (readonly Declaration[])[]): [Declaration[], Declaration[]] {
  const byTeam: [Declaration[], Declaration[]] = [[], []];
  declared.forEach((list, seat) => byTeam[(seat % 2) as Team].push(...list));
  const out: [Declaration[], Declaration[]] = [[], []];
  for (const kind of ['seq', 'carre'] as const) {
    const pick = (d: Declaration): boolean => (kind === 'seq' ? d.kind !== 'carre' : d.kind === 'carre');
    const key = kind === 'seq' ? seqKey : carreKey;
    const best = byTeam.map((list) => Math.max(-1, ...list.filter(pick).map(key)));
    if (best[0] === best[1]) continue;
    const w: Team = best[0]! > best[1]! ? 0 : 1;
    out[w].push(...byTeam[w].filter(pick));
  }
  return out;
}

// ---------------------------------------------------------------- the deal

export type Phase = 'bidding' | 'playing' | 'done' | 'thrown';

export interface Played {
  seat: Seat;
  card: Card;
}

export interface Deal {
  dealer: Seat;
  hands: Card[][];
  /** The 12 cards dealt after the bidding (3 each, from the dealer's right). */
  stock: Card[];
  phase: Phase;
  turn: Seat;
  calls: { seat: Seat; call: Call }[];
  contract: Contract | null;
  /** Who made the winning bid. */
  bidder: Seat | null;
  mult: 1 | 2 | 4;
  trick: Played[];
  tricks: { cards: Played[]; winner: Seat }[];
  /** What each seat declared with its first card (and kept after the comparison: see `scoring`). */
  declared: Declaration[][];
  /** Belote calls: who called it, in which suit. */
  belotes: { seat: Seat; suit: Suit }[];
}

/** Deals five cards each (3 then 2, counter-clockwise from the dealer's right); bidding starts there. */
export function newDeal(seed: number, dealer: Seat): Deal {
  const deck = shuffled(seed);
  const hands: Card[][] = [[], [], [], []];
  let i = 0;
  for (const n of [3, 2]) for (let k = 1; k <= 4; k++) for (let j = 0; j < n; j++) hands[next(dealer, k)]!.push(deck[i++]!);
  return {
    dealer,
    hands: hands.map((h) => sortHand(h)),
    stock: deck.slice(i),
    phase: 'bidding',
    turn: next(dealer),
    calls: [],
    contract: null,
    bidder: null,
    mult: 1,
    trick: [],
    tricks: [],
    declared: [[], [], [], []],
    belotes: [],
  };
}

/** Hand order on screen: by suit (alternating colours), then by strength in that suit. */
export function sortHand(hand: readonly Card[], k: Contract | null = null): Card[] {
  const order = [3, 2, 0, 1];
  return [...hand].sort((a, b) => order.indexOf(suitOf(a)) - order.indexOf(suitOf(b)) || strength(b, k) - strength(a, k));
}

/** The calls the seat to act may make. */
export function legalCalls(d: Deal): Call[] {
  if (d.phase !== 'bidding') return [];
  const out: Call[] = [{ k: 'pass' }];
  const lowest = d.contract === null ? 0 : d.contract + 1;
  for (let c = lowest; c <= AT; c++) out.push({ k: 'bid', c: c as Contract });
  if (d.bidder !== null) {
    const mine = teamOf(d.bidder) === teamOf(d.turn);
    if (!mine && d.mult === 1) out.push({ k: 'double' });
    if (mine && d.mult === 2) out.push({ k: 'redouble' });
  }
  return out;
}

const sameCall = (a: Call, b: Call): boolean => a.k === b.k && (a.k !== 'bid' || a.c === (b as { c: Contract }).c);
export const isLegalCall = (d: Deal, call: Call): boolean => legalCalls(d).some((c) => sameCall(c, call));

/** Makes a call. Three passes after a bid deal the rest and start play; four passes throw the cards in. */
export function applyCall(d: Deal, call: Call): Deal {
  if (!isLegalCall(d, call)) return d;
  const n: Deal = { ...d, calls: [...d.calls, { seat: d.turn, call }] };
  if (call.k === 'bid') {
    n.contract = call.c;
    n.bidder = d.turn;
    n.mult = 1;
  } else if (call.k === 'double') n.mult = 2;
  else if (call.k === 'redouble') n.mult = 4;
  // the bidding ends on three passes in a row after a bid, or four passes without one
  let passes = 0;
  for (let i = n.calls.length - 1; i >= 0 && n.calls[i]!.call.k === 'pass'; i--) passes++;
  if (n.contract === null && passes === 4) return { ...n, phase: 'thrown' };
  if (n.contract !== null && passes === 3) return startPlay(n);
  n.turn = next(d.turn);
  return n;
}

function startPlay(d: Deal): Deal {
  const hands = d.hands.map((h) => [...h]);
  let i = 0;
  for (let k = 1; k <= 4; k++) for (let j = 0; j < 3; j++) hands[next(d.dealer, k)]!.push(d.stock[i++]!);
  return { ...d, hands: hands.map((h) => sortHand(h, d.contract)), stock: [], phase: 'playing', turn: next(d.dealer) };
}

/** The card currently holding a trick (null for an empty trick). */
export function winningPlay(trick: readonly Played[], k: Contract): Played | null {
  if (!trick.length) return null;
  const led = suitOf(trick[0]!.card);
  let best = trick[0]!;
  for (const p of trick.slice(1)) {
    const pt = isTrump(p.card, k) && k !== AT;
    const bt = isTrump(best.card, k) && k !== AT;
    if (pt && !bt) best = p;
    else if (pt === bt && suitOf(p.card) === suitOf(best.card) && (pt || suitOf(p.card) === led) && strength(p.card, k) > strength(best.card, k)) best = p;
  }
  return best;
}

/** The cards `seat` may play now (follow suit, trump and over-trump rules of the contract). */
export function legalCards(d: Deal, seat: Seat = d.turn): Card[] {
  const hand = d.hands[seat]!;
  if (d.phase !== 'playing' || d.contract === null) return [];
  const k = d.contract;
  if (!d.trick.length) return [...hand];
  const led = suitOf(d.trick[0]!.card);
  const follow = hand.filter((c) => suitOf(c) === led);
  const top = winningPlay(d.trick, k)!;
  if (k === NT) return follow.length ? follow : [...hand];
  if (k === AT) {
    if (!follow.length) return [...hand];
    // beat the best card of the led suit so far if you can
    const higher = follow.filter((c) => strength(c, k) > strength(top.card, k));
    return higher.length ? higher : follow;
  }
  if (follow.length) {
    if (led !== k) return follow;
    // a trump lead: go over the highest trump if you can
    const higher = follow.filter((c) => strength(c, k) > strength(top.card, k));
    return higher.length ? higher : follow;
  }
  // void in the led suit: a partner holding the trick frees you
  if (teamOf(top.seat) === teamOf(seat)) return [...hand];
  const trumps = hand.filter((c) => suitOf(c) === k);
  if (!trumps.length) return [...hand];
  if (!isTrump(top.card, k)) return trumps;
  const over = trumps.filter((c) => strength(c, k) > strength(top.card, k));
  return over.length ? over : [...hand];
}

/** Whether playing `card` calls belote: the K or Q of a trump suit with its partner still in hand. */
export function callsBelote(d: Deal, seat: Seat, card: Card): boolean {
  const k = d.contract;
  if (k === null || k === NT || !isTrump(card, k)) return false;
  const r = rankOf(card);
  if (r !== 5 && r !== 6) return false;
  const other = cardOf(suitOf(card), r === 5 ? 6 : 5);
  if (!d.hands[seat]!.includes(other)) return false;
  // in all trumps it counts when the card leads or follows suit, not when it is thrown away
  if (k === AT && d.trick.length && suitOf(d.trick[0]!.card) !== suitOf(card)) return false;
  return true;
}

/**
 * Plays a card for the seat to act. On a seat's first card it declares `declare` (its best
 * declarations by default; pass [] to keep them quiet). Belote is called by itself.
 */
export function playCard(d: Deal, card: Card, declare?: Declaration[]): Deal {
  if (d.phase !== 'playing' || !legalCards(d).includes(card)) return d;
  const seat = d.turn;
  const n: Deal = { ...d, hands: d.hands.map((h) => [...h]), trick: [...d.trick, { seat, card }], declared: d.declared.map((x) => [...x]), belotes: [...d.belotes] };
  if (d.tricks.length === 0) {
    // only what the hand really holds: a chosen subset of its best declarations
    const can = declarationsOf(d.hands[seat]!, d.contract!);
    n.declared[seat] = declare ? can.filter((x) => declare.some((y) => y.kind === x.kind && y.rank === x.rank && y.suit === x.suit)) : can;
  }
  if (callsBelote(d, seat, card)) n.belotes.push({ seat, suit: suitOf(card) });
  n.hands[seat] = n.hands[seat]!.filter((c) => c !== card);
  if (n.trick.length < 4) {
    n.turn = next(seat);
    return n;
  }
  const winner = winningPlay(n.trick, d.contract!)!.seat;
  n.tricks = [...d.tricks, { cards: n.trick, winner }];
  n.trick = [];
  n.turn = winner;
  if (n.tricks.length === 8) n.phase = 'done';
  return n;
}

// ---------------------------------------------------------------- scoring

/** Rounding to game points (tenths): suit 6, all trumps 4 go toward the team behind; no trumps 5 and up go up. */
function roundOne(x: number, k: Contract, behind: boolean): number {
  const q = Math.floor(x / 10);
  const r = x % 10;
  if (k === NT) return r >= 5 ? q + 1 : q;
  const t = k === AT ? 4 : 6;
  return r > t ? q + 1 : r < t ? q : behind ? q + 1 : q;
}
const roundTotal = (x: number, k: Contract): number => roundOne(x, k, true);

export type Outcome = 'outside' | 'inside' | 'hanging' | 'doubled' | 'thrown';

export interface DealScore {
  contract: Contract;
  bidder: Seat;
  mult: 1 | 2 | 4;
  /** Per team: card points (with the last 10; doubled in no trumps). */
  cards: [number, number];
  lastTrick: Team;
  /** Per team: the declarations that counted, belotes, valat bonus. */
  decls: [Declaration[], Declaration[]];
  belote: [number, number];
  valat: Team | null;
  /** Per team: everything added up (what decides outside / inside). */
  raw: [number, number];
  outcome: Outcome;
  /** Game points this deal gives each team (hanging points from before not included). */
  game: [number, number];
  /** Points left hanging by this deal (they go to the winner of the next one). */
  hang: number;
  /** The team that won this deal (takes earlier hanging points), or null when it hangs. */
  winner: Team | null;
}

/**
 * Turns the two teams' totals into game points: outside (each keeps its own), inside (the other team
 * takes everything), hanging (a tie: the other team keeps its rounded-down share, the rest waits for
 * the next deal's winner), or doubled (the team ahead takes everything, ×2 or ×4).
 */
export function settle(raw: readonly [number, number], k: Contract, bt: Team, mult: 1 | 2 | 4): { outcome: Outcome; game: [number, number]; hang: number; winner: Team | null } {
  const dt = (1 - bt) as Team;
  const sum = raw[0] + raw[1];
  const game: [number, number] = [0, 0];
  if (mult > 1) {
    if (raw[0] === raw[1]) return { outcome: 'doubled', game, hang: roundTotal(sum, k) * mult, winner: null };
    const w: Team = raw[0] > raw[1] ? 0 : 1;
    game[w] = roundTotal(sum, k) * mult;
    return { outcome: 'doubled', game, hang: 0, winner: w };
  }
  if (raw[bt] > raw[dt]) {
    game[0] = roundOne(raw[0], k, raw[0] < raw[1]);
    game[1] = roundOne(raw[1], k, raw[1] < raw[0]);
    return { outcome: 'outside', game, hang: 0, winner: bt };
  }
  if (raw[bt] < raw[dt]) {
    game[dt] = roundTotal(sum, k);
    return { outcome: 'inside', game, hang: 0, winner: dt };
  }
  game[dt] = roundOne(raw[dt], k, false);
  return { outcome: 'hanging', game, hang: roundTotal(sum, k) - game[dt], winner: null };
}

/** The score of a finished deal. */
export function scoreDeal(d: Deal): DealScore {
  const k = d.contract!;
  const bidder = d.bidder!;
  const cards: [number, number] = [0, 0];
  const tricksWon: [number, number] = [0, 0];
  for (const t of d.tricks) {
    const team = teamOf(t.winner);
    tricksWon[team]++;
    for (const p of t.cards) cards[team] += points(p.card, k);
  }
  const lastTrick = teamOf(d.tricks[7]!.winner);
  cards[lastTrick] += 10;
  if (k === NT) {
    cards[0] *= 2;
    cards[1] *= 2;
  }
  const decls = scoringDeclarations(d.declared);
  const belote: [number, number] = [0, 0];
  for (const b of d.belotes) belote[teamOf(b.seat)] += 20;
  const valat: Team | null = tricksWon[0] === 8 ? 0 : tricksWon[1] === 8 ? 1 : null;
  const raw: [number, number] = [0, 1].map((t) => cards[t]! + belote[t]! + decls[t]!.reduce((n, x) => n + x.points, 0) + (valat === t ? 90 : 0)) as [number, number];
  const { outcome, game, hang, winner } = settle(raw, k, teamOf(bidder), d.mult);
  return { contract: k, bidder, mult: d.mult, cards, lastTrick, decls, belote, valat, raw, outcome, game, hang, winner };
}

// ---------------------------------------------------------------- the match

export const TARGET = 151;

export interface Match {
  seed: number;
  /** Deals dealt so far, thrown-in ones included (each has its own seed). */
  dealNo: number;
  scores: [number, number];
  /** Points waiting for the winner of the next deal. */
  hanging: number;
  deal: Deal;
  history: DealScore[];
  winner: Team | null;
}

export function newMatch(seed: number, dealer: Seat = 3): Match {
  return { seed, dealNo: 0, scores: [0, 0], hanging: 0, deal: newDeal(dealSeed(seed, 0), dealer), history: [], winner: null };
}

/** Deals the next hand (the dealer moves one seat counter-clockwise). */
export function nextDeal(m: Match): Match {
  const dealNo = m.dealNo + 1;
  return { ...m, dealNo, deal: newDeal(dealSeed(m.seed, dealNo), next(m.deal.dealer)) };
}

/**
 * Books a finished deal: game points, hanging points to this deal's winner, and the match winner (the
 * first to 151, the higher score when both are; never on a valat, and never on a tie).
 */
export function bookDeal(m: Match): { match: Match; score: DealScore; taken: number } {
  const score = scoreDeal(m.deal);
  const scores: [number, number] = [m.scores[0] + score.game[0], m.scores[1] + score.game[1]];
  let hanging = m.hanging + score.hang;
  let taken = 0;
  if (score.winner !== null && m.hanging > 0) {
    taken = m.hanging;
    scores[score.winner] += m.hanging;
    hanging = score.hang;
  }
  let winner: Team | null = null;
  if (score.valat === null && (scores[0] >= TARGET || scores[1] >= TARGET) && scores[0] !== scores[1]) winner = scores[0] > scores[1] ? 0 : 1;
  return { match: { ...m, scores, hanging, history: [...m.history, score], winner }, score, taken };
}
