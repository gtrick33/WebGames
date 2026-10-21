/**
 * Belot's computer players. Every level sees only what a player at the table sees: its own hand, the
 * calls, every card played, declared combinations (shown after the first trick), belote calls, and
 * what not following suit or not trumping gives away. Pure and seeded: the same position and random
 * source always give the same choice (the live room runs it too).
 *
 * - easy: mostly random legal cards, bids only on obvious hands, never doubles
 * - medium: sensible single-trick play without counting cards, bids by hand strength
 * - hard: counts cards (masters, voids, trumps left), draws trumps, smears points on a partner's trick
 * - expert: hard's knowledge plus simulation: deals out possible hands for the others, plays every
 *   candidate to the end, keeps the best on average (cards and bids)
 */
import {
  applyCall,
  AT,
  cardOf,
  isTrump,
  legalCalls,
  legalCards,
  next,
  NT,
  playCard,
  points,
  rankOf,
  scoreDeal,
  strength,
  suitOf,
  teamOf,
  winningPlay,
  type Call,
  type Card,
  type Contract,
  type Deal,
  type Played,
  type Seat,
  type Suit,
} from './logic';

export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];

// ---------------------------------------------------------------- what a seat knows

export interface Knowledge {
  /** Cards no longer in anyone's hand (played, or in the trick). */
  gone: Set<Card>;
  /** Per seat, per suit: the strongest card (by the contract's order) it can still hold; -1 = void. */
  cap: number[][];
  /** Cards known to be in a seat's hand (declared combinations, the other half of a belote). */
  known: Map<Card, Seat>;
}

export function knowledge(d: Deal, me: Seat): Knowledge {
  const k = d.contract;
  const gone = new Set<Card>();
  const cap = [0, 1, 2, 3].map(() => [7, 7, 7, 7]);
  const known = new Map<Card, Seat>();
  const tricks: Played[][] = [...d.tricks.map((t) => t.cards), d.trick];
  for (const t of tricks) {
    for (let i = 0; i < t.length; i++) {
      const p = t[i]!;
      gone.add(p.card);
      if (i === 0 || k === null) continue;
      const led = suitOf(t[0]!.card);
      const before = t.slice(0, i);
      const top = winningPlay(before, k)!;
      const s = p.seat;
      if (suitOf(p.card) !== led) {
        cap[s]![led] = -1;
        if (k < NT && led !== k) {
          // void and an opponent held the trick: trumping was a must
          const opp = teamOf(top.seat) !== teamOf(s);
          if (opp && suitOf(p.card) !== k) {
            if (!isTrump(top.card, k)) cap[s]![k] = -1;
            else cap[s]![k] = Math.min(cap[s]![k]!, strength(top.card, k) - 1);
          }
          if (opp && suitOf(p.card) === k && isTrump(top.card, k) && strength(p.card, k) < strength(top.card, k)) cap[s]![k] = Math.min(cap[s]![k]!, strength(top.card, k) - 1);
        }
      } else if ((k === AT || (k < NT && led === k)) && suitOf(top.card) === led && strength(p.card, k) < strength(top.card, k)) {
        // had to beat the best card if possible, and did not: nothing higher left in that suit
        cap[s]![led] = Math.min(cap[s]![led]!, strength(top.card, k) - 1);
      }
    }
  }
  // combinations declared in the first trick are shown; a belote's other half is in that hand
  if (d.tricks.length >= 1)
    d.declared.forEach((list, s) => {
      for (const x of list) for (const c of x.cards) if (!gone.has(c)) known.set(c, s as Seat);
    });
  for (const b of d.belotes) for (const r of [5, 6]) {
    const c = cardOf(b.suit, r);
    if (!gone.has(c)) known.set(c, b.seat);
  }
  for (const c of d.hands[me]!) known.set(c, me);
  return { gone, cap, known };
}

/** Cards not yet played and not in `me`'s hand. */
const unseen = (d: Deal, me: Seat, kn: Knowledge): Card[] => {
  const mine = new Set(d.hands[me]);
  const out: Card[] = [];
  for (let c = 0; c < 32; c++) if (!kn.gone.has(c) && !mine.has(c)) out.push(c);
  return out;
};

/** Whether `card` is the best card left in its suit (nobody else can hold a higher one). */
function isMaster(d: Deal, me: Seat, kn: Knowledge, card: Card): boolean {
  const k = d.contract;
  const s = suitOf(card);
  const str = strength(card, k);
  for (let r = 0; r < 8; r++) {
    const c = cardOf(s, r);
    if (c === card || kn.gone.has(c) || d.hands[me]!.includes(c)) continue;
    if (strength(c, k) > str) return false;
  }
  return true;
}

/** Whether a seat might still hold cards of a suit (not shown void). */
const mayHold = (kn: Knowledge, seat: Seat, s: Suit): boolean => kn.cap[seat]![s]! >= 0;

// ---------------------------------------------------------------- card play

/** The trick's points so far. */
const trickPoints = (d: Deal): number => d.trick.reduce((n, p) => n + points(p.card, d.contract), 0);

/** Lowest-value card: no points, short suits first, never a master unless there is nothing else. */
function cheapest(d: Deal, me: Seat, kn: Knowledge, cards: Card[], counting: boolean): Card {
  const k = d.contract;
  const hand = d.hands[me]!;
  const len = (s: Suit): number => hand.filter((c) => suitOf(c) === s).length;
  return [...cards].sort((a, b) => cost(a) - cost(b))[0]!;
  function cost(c: Card): number {
    let v = points(c, k) * 10 + strength(c, k);
    if (isTrump(c, k) && k !== AT) v += 60;
    if (counting && isMaster(d, me, kn, c)) v += 80;
    v += len(suitOf(c)) * 2;
    return v;
  }
}

/** The cheapest card that takes the lead now, or null. */
function cheapestWinner(d: Deal, cards: Card[], me: Seat): Card | null {
  const k = d.contract!;
  const wins = cards.filter((c) => winningPlay([...d.trick, { seat: me, card: c }], k)!.card === c);
  if (!wins.length) return null;
  return wins.sort((a, b) => points(a, k) + strength(a, k) * 0.5 + (isTrump(a, k) && k !== AT ? 8 : 0) - (points(b, k) + strength(b, k) * 0.5 + (isTrump(b, k) && k !== AT ? 8 : 0)))[0]!;
}

/** Whether `s` could be holding `c` (not shown void or capped below it, not known to be elsewhere). */
const couldHold = (d: Deal, kn: Knowledge, s: Seat, c: Card): boolean => (kn.known.get(c) ?? s) === s && kn.cap[s]![suitOf(c)]! >= strength(c, d.contract);

/**
 * Whether the card holding `trick` stays on top: no opponent still to play can beat it, as far as `me`
 * knows. Without counting (medium) only the top card of a suit counts as safe.
 */
function holds(d: Deal, trick: readonly Played[], me: Seat, kn: Knowledge, counting: boolean): boolean {
  const k = d.contract!;
  const top = winningPlay(trick, k);
  if (!top) return false;
  const led = suitOf(trick[0]!.card);
  const last = trick[trick.length - 1]!.seat;
  const inTrick = new Set(trick.map((p) => p.card));
  const rest = unseen(d, me, kn).filter((c) => !inTrick.has(c));
  const ruffable = k < NT && !isTrump(top.card, k);
  for (let i = 1; i <= 4 - trick.length; i++) {
    const s = next(last, i);
    if (s === me || teamOf(s) === teamOf(top.seat)) continue;
    const canFollow = mayHold(kn, s, led);
    if (counting) {
      const higher = rest.some((c) => suitOf(c) === suitOf(top.card) && strength(c, k) > strength(top.card, k) && couldHold(d, kn, s, c));
      // a higher card of the led suit when following, or a higher trump when void (over-trumping)
      if (higher && (suitOf(top.card) === led ? canFollow : !canFollow)) return false;
    } else if (rankOf(top.card) !== (isTrump(top.card, k) ? 4 : 7)) return false;
    if (ruffable && !canFollow && rest.some((c) => suitOf(c) === k && couldHold(d, kn, s, c))) return false;
  }
  return true;
}

function leadCard(d: Deal, me: Seat, kn: Knowledge, legal: Card[], counting: boolean): Card {
  const k = d.contract!;
  const hand = d.hands[me]!;
  const rest = unseen(d, me, kn);
  const opps: Seat[] = [next(me), next(me, 3)];
  const partner = next(me, 2);
  const master = (c: Card): boolean => (counting ? isMaster(d, me, kn, c) : rankOf(c) === (isTrump(c, k) ? 4 : 7));
  if (k < NT) {
    const trumps = hand.filter((c) => suitOf(c) === k);
    const trumpsOut = rest.filter((c) => suitOf(c) === k).length;
    const ours = teamOf(d.bidder!) === teamOf(me);
    // the contract team draws trumps with its masters
    if (ours && trumps.length && trumpsOut > 0 && opps.some((s) => mayHold(kn, s, k as Suit))) {
      const top = trumps.find(master);
      if (top !== undefined) return top;
      if (me === d.bidder && trumps.length >= 3) return trumps.sort((a, b) => strength(a, k) - strength(b, k))[0]!;
    }
    // a side-suit master, when no opponent can ruff it
    const safe = legal.filter((c) => !isTrump(c, k) && master(c) && points(c, k) > 0 && opps.every((s) => mayHold(kn, s, suitOf(c)) || !mayHold(kn, s, k as Suit) || !rest.some((x) => suitOf(x) === k)));
    if (safe.length) return safe.sort((a, b) => points(b, k) - points(a, k))[0]!;
    // a suit the partner is void in, when the partner still has trumps (a ruff for the team)
    if (counting) {
      const ruff = legal.filter((c) => !isTrump(c, k) && !mayHold(kn, partner, suitOf(c)) && mayHold(kn, partner, k as Suit) && points(c, k) <= 4);
      if (ruff.length) return cheapest(d, me, kn, ruff, counting);
    }
    // otherwise something low from a side suit, never a lone 10 under an ace still out
    const side = legal.filter((c) => !isTrump(c, k) && !(rankOf(c) === 3 && !hand.includes(cardOf(suitOf(c), 7)) && !kn.gone.has(cardOf(suitOf(c), 7))));
    return cheapest(d, me, kn, side.length ? side : legal, counting);
  }
  // no trumps and all trumps: cash masters, then lead low from the longest suit
  const masters = legal.filter(master);
  if (masters.length) return masters.sort((a, b) => points(b, k) - points(a, k))[0]!;
  const bySuit = (s: Suit): number => hand.filter((c) => suitOf(c) === s).length;
  const lows = legal.filter((c) => points(c, k) <= 4);
  if (lows.length) return lows.sort((a, b) => bySuit(suitOf(b)) - bySuit(suitOf(a)) || strength(a, k) - strength(b, k))[0]!;
  return cheapest(d, me, kn, legal, counting);
}

function followCard(d: Deal, me: Seat, kn: Knowledge, legal: Card[], counting: boolean): Card {
  const k = d.contract!;
  const top = winningPlay(d.trick, k)!;
  const last = d.trick.length === 3;
  const pts = trickPoints(d);
  if (teamOf(top.seat) === teamOf(me)) {
    if (holds(d, d.trick, me, kn, counting)) {
      // the partner has it: give it points, but keep masters and trumps
      const give = legal.filter((c) => !(isTrump(c, k) && k !== AT) && !(counting && isMaster(d, me, kn, c)));
      if (give.length) return give.sort((a, b) => points(b, k) - points(a, k) || strength(a, k) - strength(b, k))[0]!;
      return cheapest(d, me, kn, legal, counting);
    }
    // not safe yet: take over with a master when there are points to save
    const over = legal.filter((c) => winningPlay([...d.trick, { seat: me, card: c }], k)!.card === c && (counting ? isMaster(d, me, kn, c) : rankOf(c) === 7));
    if (over.length && pts >= 10) return over.sort((a, b) => strength(a, k) - strength(b, k))[0]!;
    return cheapest(d, me, kn, legal, counting);
  }
  const win = cheapestWinner(d, legal, me);
  if (win === null) return cheapest(d, me, kn, legal, counting);
  const cost = points(win, k);
  const ruff = isTrump(win, k) && k !== AT && !isTrump(top.card, k);
  if (last) return pts + cost >= 4 || cost === 0 ? win : cheapest(d, me, kn, legal, counting);
  // not last: win when it is likely to hold, or when the trick is rich and the card is cheap
  const after = [...d.trick, { seat: me, card: win }];
  const stays = holds(d, after, me, kn, counting) || (counting && isMaster(d, me, kn, win) && !ruff);
  if (stays) return win;
  if (ruff && pts >= 10) return win;
  return cheapest(d, me, kn, legal, counting);
}

/** The hard (counting) or medium (not counting) choice of card. */
export function heuristicCard(d: Deal, me: Seat, counting = true): Card {
  const legal = legalCards(d, me);
  if (legal.length === 1) return legal[0]!;
  const kn = knowledge(d, me);
  return d.trick.length ? followCard(d, me, kn, legal, counting) : leadCard(d, me, kn, legal, counting);
}

// ---------------------------------------------------------------- simulation (expert)

/**
 * Deals the cards `me` cannot see: `mine` more to `me` first (the bidding: cards still to come), then
 * the rest to the other seats up to their hand sizes plus `extra`, known cards where they are, every
 * void and cap respected (a dead end retries, and the last tries drop the caps).
 */
export function sampleWorld(d: Deal, me: Seat, kn: Knowledge, r: () => number, extra = 0, mine = 0): Card[][] | null {
  const k = d.contract;
  const want = d.hands.map((h, s) => (s === me ? h.length + mine : h.length + extra));
  const base: Card[][] = d.hands.map((h, s) => (s === me ? [...h] : []));
  for (const [c, s] of kn.known) if (s !== me && !kn.gone.has(c)) base[s]!.push(c);
  const free = unseen(d, me, kn).filter((c) => !kn.known.has(c));
  const fits = (s: Seat, c: Card, caps: boolean): boolean => !caps || kn.cap[s]![suitOf(c)]! >= strength(c, k);
  const others = ([0, 1, 2, 3] as Seat[]).filter((s) => s !== me);
  for (let attempt = 0; attempt < 24; attempt++) {
    const caps = attempt < 16;
    const h = base.map((x) => [...x]);
    const left = [...free];
    for (let i = left.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [left[i], left[j]] = [left[j]!, left[i]!];
    }
    while (h[me]!.length < want[me]! && left.length) h[me]!.push(left.pop()!);
    const owners = (c: Card): number => others.filter((s) => fits(s, c, caps)).length;
    left.sort((a, b) => owners(a) - owners(b));
    let ok = true;
    for (const c of left) {
      const room = others.filter((s) => h[s]!.length < want[s]! && fits(s, c, caps));
      if (!room.length) {
        ok = false;
        break;
      }
      h[room[Math.floor(r() * room.length)]!]!.push(c);
    }
    if (ok && h.every((x, s) => x.length === want[s])) return h;
  }
  return null;
}

/** Plays a deal to the end with the hard player in every seat; the score difference for `me`'s team. */
function playOut(d: Deal, me: Seat): number {
  let x = d;
  let guard = 40;
  while (x.phase === 'playing' && guard-- > 0) x = playCard(x, heuristicCard(x, x.turn, true));
  if (x.phase !== 'done') return 0;
  const sc = scoreDeal(x);
  const t = teamOf(me);
  return sc.game[t] - sc.game[1 - t]! + (sc.raw[t] - sc.raw[1 - t]!) / 100;
}

function expertCard(d: Deal, me: Seat, r: () => number): Card {
  const legal = legalCards(d, me);
  if (legal.length === 1) return legal[0]!;
  const kn = knowledge(d, me);
  const samples = d.tricks.length < 3 ? 28 : 40;
  const total = legal.map(() => 0);
  let used = 0;
  for (let n = 0; n < samples; n++) {
    const world = sampleWorld(d, me, kn, r);
    if (!world) continue;
    used++;
    const base: Deal = { ...d, hands: world };
    legal.forEach((c, i) => {
      total[i]! += playOut(playCard(base, c), me);
    });
  }
  if (!used) return heuristicCard(d, me, true);
  let best = 0;
  for (let i = 1; i < legal.length; i++) if (total[i]! > total[best]!) best = i;
  return legal[best]!;
}

// ---------------------------------------------------------------- bidding

/** What a five-card hand is worth for a contract (a rough count of the points it brings in). */
export function handValue(hand: readonly Card[], c: Contract): number {
  let v = 0;
  const has = (s: Suit, r: number): boolean => hand.includes(cardOf(s, r));
  if (c < NT) {
    const t = c as Suit;
    const trumps = hand.filter((x) => suitOf(x) === t);
    for (const x of trumps) v += [5, 5, has(t, 4) ? 22 : 14, has(t, 7) || has(t, 4) ? 12 : 7, 30, 6, 6, has(t, 4) || has(t, 2) ? 15 : 11][rankOf(x)]!;
    if (trumps.length >= 3) v += 10;
    for (const s of [0, 1, 2, 3] as Suit[]) {
      if (s === t) continue;
      if (has(s, 7)) v += 14;
      if (has(s, 3)) v += has(s, 7) ? 8 : 3;
    }
    if (!has(t, 4) && !(has(t, 2) && trumps.length >= 3)) v -= 25;
    return v;
  }
  if (c === AT) {
    let jacks = 0;
    for (const s of [0, 1, 2, 3] as Suit[]) {
      if (has(s, 4)) {
        v += 22;
        jacks++;
      }
      if (has(s, 2)) v += has(s, 4) ? 16 : 8;
      if (has(s, 7)) v += has(s, 4) || has(s, 2) ? 7 : 3;
    }
    if (jacks < 2) v -= 20;
    return v;
  }
  let aces = 0;
  for (const s of [0, 1, 2, 3] as Suit[]) {
    if (has(s, 7)) {
      v += 18;
      aces++;
    }
    if (has(s, 3)) v += has(s, 7) ? 12 : 3;
    if (has(s, 6) && has(s, 7) && has(s, 3)) v += 4;
  }
  if (aces < 2) v -= 20;
  return v;
}

/** How strong a hand is against the other team's contract (for a contra). */
function defenceValue(hand: readonly Card[], c: Contract): number {
  let v = 0;
  const has = (s: Suit, r: number): boolean => hand.includes(cardOf(s, r));
  for (const s of [0, 1, 2, 3] as Suit[]) {
    if (c === AT || (c < NT && s === c)) v += (has(s, 4) ? 24 : 0) + (has(s, 2) ? 14 : 0) + (has(s, 7) ? 6 : 0);
    else v += (has(s, 7) ? 12 : 0) + (has(s, 3) && has(s, 7) ? 7 : 0);
  }
  return v;
}

const THRESH: Record<Level, number> = { easy: 70, medium: 52, hard: 48, expert: 48 };

function heuristicCall(d: Deal, me: Seat, level: Level, r: () => number): Call {
  const hand = d.hands[me]!;
  const legal = legalCalls(d);
  const partner = next(me, 2);
  const noise = level === 'medium' ? (r() - 0.5) * 16 : level === 'easy' ? (r() - 0.5) * 24 : 0;
  // what the partner said helps: a suit bid means its jack or nine is likely there
  const fromPartner = (c: Contract): number => {
    let v = 0;
    for (const x of d.calls) {
      if (x.seat !== partner || x.call.k !== 'bid') continue;
      if (c === AT && x.call.c < NT) v += 14;
      if (c === NT && x.call.c === NT) v += 14;
      if (c === x.call.c) v += 10;
    }
    return v;
  };
  let best: Call = { k: 'pass' };
  let bestV = -Infinity;
  for (const call of legal) {
    if (call.k !== 'bid') continue;
    const v = handValue(hand, call.c) + fromPartner(call.c) + noise - (call.c >= NT ? 4 : 0);
    if (v >= THRESH[level] + (d.contract !== null ? 6 : 0) && v > bestV) {
      best = call;
      bestV = v;
    }
  }
  if (best.k === 'bid') return best;
  if (level !== 'easy' && d.contract !== null && d.bidder !== null) {
    const ours = teamOf(d.bidder) === teamOf(me);
    if (!ours && legal.some((c) => c.k === 'double') && defenceValue(hand, d.contract) + noise >= (level === 'medium' ? 52 : 46)) return { k: 'double' };
    if (ours && legal.some((c) => c.k === 'redouble') && handValue(hand, d.contract) + fromPartner(d.contract) >= 70) return { k: 'redouble' };
  }
  return { k: 'pass' };
}

/**
 * The expert bids by simulation: for each contract it could name, it deals out the unseen cards,
 * plays the deal to the end as the contract team and keeps the contract with the best average.
 */
function expertCall(d: Deal, me: Seat, r: () => number): Call {
  const legal = legalCalls(d);
  const base = heuristicCall(d, me, 'hard', r);
  const bids = legal.filter((c): c is Extract<Call, { k: 'bid' }> => c.k === 'bid');
  if (!bids.length) return base;
  // the full deal is unknown: five cards each now, three more each to come
  const kn: { gone: Set<Card>; cap: number[][]; known: Map<Card, Seat> } = { gone: new Set(), cap: [0, 1, 2, 3].map(() => [7, 7, 7, 7]), known: new Map(d.hands[me]!.map((c) => [c, me])) };
  const samples = 14;
  const value = new Map<number, number>();
  for (const b of bids) value.set(b.c, 0);
  for (let n = 0; n < samples; n++) {
    const hands = sampleWorld({ ...d, contract: null }, me, kn, r, 3, 3);
    if (!hands) continue;
    for (const b of bids) {
      const x: Deal = { dealer: d.dealer, hands: hands.map((h) => [...h]), stock: [], phase: 'playing', turn: next(d.dealer), calls: [], contract: b.c, bidder: me, mult: 1, trick: [], tricks: [], declared: [[], [], [], []], belotes: [] };
      value.set(b.c, value.get(b.c)! + playOut(x, me));
    }
  }
  let best: Contract | null = null;
  let bestV = 1.2 * samples;
  for (const [c, v] of value) if (v > bestV) {
    best = c as Contract;
    bestV = v;
  }
  if (best !== null) return { k: 'bid', c: best };
  return base.k === 'bid' ? { k: 'pass' } : base;
}

// ---------------------------------------------------------------- entry points

export function chooseCall(d: Deal, me: Seat, level: Level, r: () => number): Call {
  if (level === 'expert') return expertCall(d, me, r);
  return heuristicCall(d, me, level, r);
}

export function chooseCard(d: Deal, me: Seat, level: Level, r: () => number): Card {
  const legal = legalCards(d, me);
  if (legal.length === 1) return legal[0]!;
  if (level === 'easy') return r() < 0.6 ? legal[Math.floor(r() * legal.length)]! : heuristicCard(d, me, false);
  if (level === 'medium') return r() < 0.15 ? legal[Math.floor(r() * legal.length)]! : heuristicCard(d, me, false);
  if (level === 'hard') return heuristicCard(d, me, true);
  return expertCard(d, me, r);
}

/** The computer's move for whoever is to act (a call while bidding, a card while playing). */
export function botMove(d: Deal, level: Level, r: () => number): { call: Call } | { card: Card } | null {
  if (d.phase === 'bidding') return { call: chooseCall(d, d.turn, level, r) };
  if (d.phase === 'playing') return { card: chooseCard(d, d.turn, level, r) };
  return null;
}

/** Applies the computer's move (declarations: always its best). */
export function applyBot(d: Deal, level: Level, r: () => number): Deal {
  const m = botMove(d, level, r);
  if (!m) return d;
  return 'call' in m ? applyCall(d, m.call) : playCard(d, m.card);
}
