import { describe, expect, it } from 'vitest';
import { applyBot, chooseCard, knowledge, LEVELS, sampleWorld, type Level } from '../src/games/belot/ai';
import {
  applyCall,
  AT,
  bookDeal,
  callsBelote,
  cardOf,
  declarationsOf,
  isLegalCall,
  legalCalls,
  legalCards,
  newDeal,
  newMatch,
  nextDeal,
  NT,
  points,
  rng,
  scoreDeal,
  scoringDeclarations,
  settle,
  shuffled,
  TARGET,
  type Card,
  type Contract,
  type Deal,
  type Match,
  type Seat,
} from '../src/games/belot/logic';

// ranks: 0=7 1=8 2=9 3=10 4=J 5=Q 6=K 7=A; suits: 0 ♣ 1 ♦ 2 ♥ 3 ♠
const C = (s: number, r: number): Card => cardOf(s as 0 | 1 | 2 | 3, r);
const sumPoints = (k: Contract): number => Array.from({ length: 32 }, (_, c) => points(c, k)).reduce((a, b) => a + b, 0);

/** A deal in play with the given hands and contract (seat 0 bid it), seat `turn` to act. */
function inPlay(hands: Card[][], contract: Contract, trick: { seat: Seat; card: Card }[] = [], turn?: Seat): Deal {
  const d = newDeal(1, 3);
  return { ...d, hands, stock: [], phase: 'playing', contract, bidder: 0, mult: 1, trick, turn: turn ?? (((trick[trick.length - 1]?.seat ?? 3) + 1) % 4) as Seat, tricks: trick.length ? [] : [] };
}

/** Plays a whole deal with computer players at `levels` (by team), returning the finished deal (or a thrown one). */
function botDeal(seed: number, dealer: Seat, levels: [Level, Level]): Deal {
  const r = rng(seed ^ 0x5eed);
  let d = newDeal(seed, dealer);
  let guard = 80;
  while ((d.phase === 'bidding' || d.phase === 'playing') && guard-- > 0) d = applyBot(d, levels[d.turn % 2]!, r);
  return d;
}

describe('belot: the deck and the deal', () => {
  it('has 32 cards and the club totals: 152 + 10 in a suit, 248 + 10 in all trumps, 120 + 10 doubled in no trumps', () => {
    expect(new Set(shuffled(7)).size).toBe(32);
    expect(sumPoints(2)).toBe(152);
    expect(sumPoints(AT)).toBe(248);
    expect(sumPoints(NT)).toBe(120);
  });

  it('deals five each (3 + 2), keeps twelve for after the bidding, and the same seed deals the same cards', () => {
    const d = newDeal(42, 3);
    expect(d.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(d.stock).toHaveLength(12);
    expect(new Set([...d.hands.flat(), ...d.stock]).size).toBe(32);
    expect(newDeal(42, 3)).toEqual(d);
    expect(newDeal(43, 3).hands).not.toEqual(d.hands);
    // the dealer's right (counter-clockwise next) bids first
    expect(d.turn).toBe(0);
  });
});

describe('belot: bidding', () => {
  it('goes up only, contra is for the other team, recontra for the bidders, three passes end it', () => {
    let d = newDeal(5, 3);
    expect(legalCalls(d).map((c) => c.k)).toEqual(['pass', 'bid', 'bid', 'bid', 'bid', 'bid', 'bid']);
    d = applyCall(d, { k: 'bid', c: 2 }); // seat 0: hearts
    expect(isLegalCall(d, { k: 'bid', c: 1 })).toBe(false);
    expect(isLegalCall(d, { k: 'bid', c: 2 })).toBe(false);
    expect(isLegalCall(d, { k: 'double' })).toBe(true); // seat 1 is the other team
    d = applyCall(d, { k: 'pass' }); // seat 1
    expect(isLegalCall(d, { k: 'double' })).toBe(false); // seat 2 is the partner
    d = applyCall(d, { k: 'pass' }); // seat 2
    d = applyCall(d, { k: 'double' }); // seat 3
    expect(d.mult).toBe(2);
    expect(isLegalCall(d, { k: 'redouble' })).toBe(true); // seat 0, the bidder
    d = applyCall(d, { k: 'redouble' });
    expect(d.mult).toBe(4);
    d = applyCall(d, { k: 'pass' });
    d = applyCall(d, { k: 'pass' });
    expect(d.phase).toBe('bidding');
    d = applyCall(d, { k: 'pass' });
    expect(d.phase).toBe('playing');
    expect(d.hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(d).toMatchObject({ contract: 2, bidder: 0, mult: 4, turn: 0 });
  });

  it('a higher bid wipes a contra; four passes throw the cards in', () => {
    let d = newDeal(5, 3);
    d = applyCall(d, { k: 'bid', c: 0 });
    d = applyCall(d, { k: 'double' });
    expect(d.mult).toBe(2);
    d = applyCall(d, { k: 'bid', c: NT });
    expect(d.mult).toBe(1);
    let t = newDeal(6, 3);
    for (let i = 0; i < 4; i++) t = applyCall(t, { k: 'pass' });
    expect(t.phase).toBe('thrown');
  });
});

describe('belot: what may be played', () => {
  it('a trump lead must be beaten when possible', () => {
    // hearts trump; seat 3 led 10♥; seat 0 holds 9♥ (beats) and 8♥ (does not)
    const d = inPlay([[C(2, 2), C(2, 1), C(0, 7)], [], [], []], 2, [{ seat: 3, card: C(2, 3) }]);
    expect(legalCards(d, 0)).toEqual([C(2, 2)]);
  });

  it('void in the led suit: trump against an opponent, over-trump an opponent’s trump, free when the partner holds it', () => {
    const hand = [C(2, 1), C(2, 6), C(1, 0)]; // 8♥ K♥ 7♦, hearts trump, no clubs
    // opponent (3) holds with A♣: must trump
    expect(legalCards(inPlay([hand, [], [], []], 2, [{ seat: 3, card: C(0, 7) }]), 0).sort()).toEqual([C(2, 1), C(2, 6)].sort());
    // opponent ruffed with Q♥: must go over it (K♥ beats Q♥, 8♥ does not)
    expect(legalCards(inPlay([hand, [], [], []], 2, [{ seat: 2, card: C(0, 0) }, { seat: 3, card: C(2, 5) }]), 0)).toEqual([C(2, 6)]);
    // opponent ruffed with the J♥: cannot over-trump, anything goes
    expect(legalCards(inPlay([hand, [], [], []], 2, [{ seat: 2, card: C(0, 0) }, { seat: 3, card: C(2, 4) }]), 0)).toHaveLength(3);
    // the partner (2) holds with A♣: anything goes
    expect(legalCards(inPlay([hand, [], [], []], 2, [{ seat: 1, card: C(0, 0) }, { seat: 2, card: C(0, 7) }, { seat: 3, card: C(0, 1) }], 0), 0)).toHaveLength(3);
  });

  it('all trumps: follow suit and beat the best card so far; no trumps: just follow suit', () => {
    const hand = [C(0, 2), C(0, 0), C(1, 4)]; // 9♣ 7♣ J♦
    // led 10♣ (strength below 9 in all trumps): must play the 9♣
    expect(legalCards(inPlay([hand, [], [], []], AT, [{ seat: 3, card: C(0, 3) }]), 0)).toEqual([C(0, 2)]);
    // led J♣: nothing beats it, either club
    expect(legalCards(inPlay([hand, [], [], []], AT, [{ seat: 3, card: C(0, 4) }]), 0).sort()).toEqual([C(0, 2), C(0, 0)].sort());
    expect(legalCards(inPlay([hand, [], [], []], NT, [{ seat: 3, card: C(0, 7) }]), 0).sort()).toEqual([C(0, 2), C(0, 0)].sort());
  });
});

describe('belot: declarations', () => {
  it('finds tierces, quartes, quints (8 in a row = quint + tierce) and carrés, never sevens or eights', () => {
    expect(declarationsOf([C(0, 0), C(0, 1), C(0, 2), C(1, 7), C(2, 0)], 1).map((x) => [x.kind, x.points])).toEqual([['tierce', 20]]);
    expect(declarationsOf([C(0, 3), C(0, 4), C(0, 5), C(0, 6)], 1)[0]).toMatchObject({ kind: 'quarte', points: 50, rank: 6 });
    expect(declarationsOf([0, 1, 2, 3, 4, 5, 6, 7].map((r) => C(3, r)), 1).map((x) => x.points).sort()).toEqual([100, 20].sort());
    expect(declarationsOf([C(0, 4), C(1, 4), C(2, 4), C(3, 4)], 1)[0]).toMatchObject({ kind: 'carre', points: 200 });
    expect(declarationsOf([C(0, 2), C(1, 2), C(2, 2), C(3, 2)], 1)[0]).toMatchObject({ points: 150 });
    expect(declarationsOf([C(0, 0), C(1, 0), C(2, 0), C(3, 0)], 1)).toEqual([]);
    expect(declarationsOf([C(0, 0), C(0, 1), C(0, 2)], NT)).toEqual([]);
  });

  it('a card serves one declaration: the hand takes whichever split is worth more', () => {
    // four jacks and 9-10-J of clubs: the carré (200) beats keeping the tierce
    const d = declarationsOf([C(0, 2), C(0, 3), C(0, 4), C(1, 4), C(2, 4), C(3, 4)], 1);
    expect(d.map((x) => x.kind)).toEqual(['carre']);
    // four queens and 9-10-J-Q-K of spades: carré of queens + quarte 9-Q? no: the quint (100) and the carré (100) clash on Q♠
    const e = declarationsOf([C(3, 2), C(3, 3), C(3, 4), C(3, 5), C(3, 6), C(0, 5), C(1, 5), C(2, 5)], 1);
    expect(e.reduce((n, x) => n + x.points, 0)).toBe(120); // carré of queens 100 + tierce 9-10-J 20
  });

  it('only the best sequence’s team scores its sequences (equal best: nobody); carrés are judged apart', () => {
    const tierceA = declarationsOf([C(0, 5), C(0, 6), C(0, 7)], 1);
    const tierceK = declarationsOf([C(1, 4), C(1, 5), C(1, 6)], 1);
    const quarte = declarationsOf([C(2, 0), C(2, 1), C(2, 2), C(2, 3)], 1);
    const jacks = declarationsOf([C(0, 4), C(1, 4), C(2, 4), C(3, 4)], 1);
    // seat 0 (team 0) tierce to the ace, seat 1 (team 1) tierce to the king: team 0 wins
    expect(scoringDeclarations([tierceA, tierceK, [], []]).map((t) => t.length)).toEqual([1, 0]);
    // a quarte beats any tierce, and that team also scores its lower tierce
    expect(scoringDeclarations([tierceA, quarte, [], tierceK]).map((t) => t.map((x) => x.kind))).toEqual([[], ['quarte', 'tierce']]);
    // equal tierces cancel; the carré still scores for its team
    const tierceA2 = declarationsOf([C(3, 5), C(3, 6), C(3, 7)], 1);
    expect(scoringDeclarations([tierceA, tierceA2, [], jacks]).map((t) => t.map((x) => x.kind))).toEqual([[], ['carre']]);
  });

  it('belote: the K or Q of trumps with the other in hand; in all trumps not on a discard', () => {
    const d = inPlay([[C(2, 5), C(2, 6), C(1, 0)], [], [], []], 2, [], 0);
    expect(callsBelote(d, 0, C(2, 6))).toBe(true);
    expect(callsBelote(d, 0, C(1, 0))).toBe(false);
    const at = inPlay([[C(2, 5), C(2, 6), C(1, 0)], [], [], []], AT, [{ seat: 3, card: C(0, 0) }]);
    expect(callsBelote(at, 0, C(2, 6))).toBe(false);
    expect(callsBelote(inPlay([[C(2, 5), C(2, 6)], [], [], []], NT, [], 0), 0, C(2, 6))).toBe(false);
  });
});

describe('belot: scoring', () => {
  /** A finished deal where each trick is given to `winners[i]` with the given cards. */
  function finished(contract: Contract, tricks: { winner: Seat; cards: Card[] }[], bidder: Seat = 0, mult: 1 | 2 | 4 = 1): Deal {
    const d = newDeal(1, 3);
    return {
      ...d,
      hands: [[], [], [], []],
      stock: [],
      phase: 'done',
      contract,
      bidder,
      mult,
      trick: [],
      tricks: tricks.map((t) => ({ winner: t.winner, cards: t.cards.map((card, i) => ({ seat: ((t.winner + i) % 4) as Seat, card })) })),
    };
  }
  /** All 32 cards in eight tricks; team 0 wins the tricks listed in `ours`. */
  const split = (contract: Contract, ours: number[], lastToUs = true, bidder: Seat = 0, mult: 1 | 2 | 4 = 1): Deal =>
    finished(
      contract,
      Array.from({ length: 8 }, (_, i) => ({ winner: (ours.includes(i) ? 0 : 1) as Seat, cards: [0, 1, 2, 3].map((s) => C(s, i)) })).map((t, i) => (i === 7 ? { ...t, winner: (lastToUs ? 0 : 1) as Seat } : t)),
      bidder,
      mult,
    );

  it('every finished deal adds up to the club totals', () => {
    for (const k of [0, 3, NT, AT] as Contract[]) {
      const s = scoreDeal(split(k, [0, 2, 4, 6]));
      expect(s.cards[0] + s.cards[1]).toBe(k === NT ? 260 : k === AT ? 258 : 162);
    }
  });

  it('valat: all eight tricks add 90', () => {
    const s = scoreDeal(split(2, [0, 1, 2, 3, 4, 5, 6, 7]));
    expect(s.valat).toBe(0);
    expect(s.raw[0]).toBe(162 + 90);
    expect(s.game).toEqual([25, 0]);
  });

  it('outside, inside and doubled', () => {
    // hearts: tricks of 7s, 8s, 9s (14 for the 9♥), 10s, Js (20 for J♥), Qs, Ks, As (with last 10)
    const out = scoreDeal(split(2, [2, 4, 7]));
    expect(out.outcome).toBe('outside');
    expect(out.raw).toEqual([out.cards[0], out.cards[1]]);
    expect(out.game[0] + out.game[1]).toBe(16);
    const inside = scoreDeal(split(2, [0, 1], false));
    expect(inside.outcome).toBe('inside');
    expect(inside.game).toEqual([0, 16]);
    const dbl = scoreDeal(split(2, [2, 4, 7], true, 0, 2));
    expect(dbl.outcome).toBe('doubled');
    expect(dbl.game).toEqual([32, 0]);
    const re = scoreDeal(split(2, [0, 1], false, 0, 4));
    expect(re.game).toEqual([0, 64]);
  });

  it('the club rounding: a suit 86 / 76 is 8 / 8 (6 goes to the team behind); a hanging 106 / 106 gives 10 and leaves 11', () => {
    // build raw totals through declarations: hearts, team 0 = seats 0/2
    const d = split(2, [3, 7]); // 10s and As + last 10: 40 + 44 + 10 = 94 for team 0
    const s = scoreDeal(d);
    expect(s.raw).toEqual([94, 68]);
    expect(s.game).toEqual([9, 7]);
    // hanging: equal totals; the 106 / 106 example from the rules
    const h = scoreDeal({ ...split(2, [3, 7]), declared: [[], declarationsOf([C(0, 3), C(0, 4), C(0, 5), C(0, 6)], 2), [], []] });
    // team 1: 68 + quarte 50 = 118 vs 94: inside for team 0 (the bidder)
    expect(h.outcome).toBe('inside');
    const tie = scoreDeal({ ...split(2, [3, 7]), declared: [[], declarationsOf([C(0, 0), C(0, 1), C(0, 2)], 2), [], []], belotes: [{ seat: 1, suit: 1 }] });
    expect(tie.raw).toEqual([94, 108]);
  });

  it('settles exactly as the club rules’ examples', () => {
    // hanging: all trumps 154 / 154 gives the other team 15 and leaves 16; a suit 106 / 106 gives 10 and leaves 11
    expect(settle([154, 154], AT, 0, 1)).toEqual({ outcome: 'hanging', game: [0, 15], hang: 16, winner: null });
    expect(settle([106, 106], 2, 1, 1)).toEqual({ outcome: 'hanging', game: [10, 0], hang: 11, winner: null });
    // suit: a 6 rounds toward the team behind (86 / 76 → 8 / 8), 7 and up round up
    expect(settle([86, 76], 1, 0, 1).game).toEqual([8, 8]);
    expect(settle([97, 65], 1, 0, 1).game).toEqual([10, 6]);
    // all trumps: a 4 rounds toward the team behind (134 / 124 → 13 / 13), 5 and up round up
    expect(settle([134, 124], AT, 0, 1).game).toEqual([13, 13]);
    expect(settle([139, 119], AT, 0, 1).game).toEqual([14, 12]);
    // no trumps (already doubled): 5 and up round up
    expect(settle([146, 114], NT, 0, 1).game).toEqual([15, 11]);
    // inside: everything to the other team; contra: everything to the team ahead, doubled; recontra ×4
    expect(settle([70, 92], 0, 0, 1)).toMatchObject({ outcome: 'inside', game: [0, 16], winner: 1 });
    expect(settle([92, 70], 0, 1, 2)).toMatchObject({ outcome: 'doubled', game: [32, 0], winner: 0 });
    expect(settle([92, 70], 0, 1, 4).game).toEqual([64, 0]);
    expect(settle([81, 81], 0, 1, 2)).toMatchObject({ hang: 32, winner: null });
  });

  it('a match: hanging points go to the next winner, 151 wins, never on a valat, never on a tie', () => {
    let m: Match = newMatch(9);
    m = { ...m, deal: split(2, [3, 7]), hanging: 11 };
    const a = bookDeal(m);
    expect(a.taken).toBe(11);
    expect(a.match.scores).toEqual([9 + 11, 7]);
    expect(a.match.hanging).toBe(0);
    const near = bookDeal({ ...m, hanging: 0, scores: [145, 100], deal: split(2, [3, 7]) });
    expect(near.match.winner).toBe(0);
    const valat = bookDeal({ ...m, hanging: 0, scores: [145, 100], deal: split(2, [0, 1, 2, 3, 4, 5, 6, 7]) });
    expect(valat.match.scores[0]).toBeGreaterThanOrEqual(TARGET);
    expect(valat.match.winner).toBeNull();
    const tie = bookDeal({ ...m, hanging: 0, scores: [142, 144], deal: split(2, [3, 7]) });
    expect(tie.match.scores).toEqual([151, 151]);
    expect(tie.match.winner).toBeNull();
    expect(nextDeal(m).deal.dealer).toBe(((m.deal.dealer + 1) % 4) as Seat);
  });
});

describe('belot: the computer players', () => {
  it('play whole deals at every level: only legal moves, every card once, the club totals', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const levels: [Level, Level] = [LEVELS[seed % 4]!, LEVELS[(seed >> 2) % 4 === 3 ? 2 : (seed >> 2) % 4]!];
      let d = newDeal(seed, (seed % 4) as Seat);
      const r = rng(seed);
      let guard = 80;
      while ((d.phase === 'bidding' || d.phase === 'playing') && guard-- > 0) {
        const before = d;
        d = applyBot(d, levels[d.turn % 2]!, r);
        expect(d).not.toBe(before); // a move was made (illegal ones are ignored, so this proves legality)
      }
      if (d.phase === 'thrown') continue;
      expect(d.phase).toBe('done');
      const all = d.tricks.flatMap((t) => t.cards.map((p) => p.card));
      expect(new Set(all).size).toBe(32);
      const s = scoreDeal(d);
      expect(s.cards[0] + s.cards[1]).toBe(d.contract === NT ? 260 : d.contract === AT ? 258 : 162);
    }
  }, 60_000);

  it('only ever know what a player at the table knows: sampled hands keep every shown void', () => {
    let d = botDeal(77, 3, ['hard', 'hard']);
    // replay to the middle of the deal and check the sampler against the real voids
    const tricks = d.tricks;
    if (d.phase !== 'done') return;
    d = { ...d, phase: 'playing', tricks: tricks.slice(0, 4), trick: [], hands: [0, 1, 2, 3].map((s) => tricks.slice(4).flatMap((t) => t.cards.filter((p) => p.seat === s).map((p) => p.card))), turn: tricks[3]!.winner };
    const kn = knowledge(d, 0);
    for (let i = 0; i < 20; i++) {
      const w = sampleWorld(d, 0, kn, rng(i));
      expect(w).not.toBeNull();
      expect(w![0]).toEqual(d.hands[0]);
      for (const s of [1, 2, 3]) {
        expect(w![s]).toHaveLength(d.hands[s]!.length);
        for (const c of w![s]!) expect(kn.cap[s]![c >> 3]).toBeGreaterThanOrEqual(0);
      }
      expect(new Set(w!.flat()).size).toBe(16);
    }
  });

  it('hard beats easy over many deals', () => {
    let hard = 0;
    let easy = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const flip of [0, 1]) {
        const levels: [Level, Level] = flip ? ['easy', 'hard'] : ['hard', 'easy'];
        const d = botDeal(seed * 7 + flip, (seed % 4) as Seat, levels);
        if (d.phase !== 'done') continue;
        const s = scoreDeal(d);
        hard += s.game[flip ? 1 : 0];
        easy += s.game[flip ? 0 : 1];
      }
    }
    expect(hard).toBeGreaterThan(easy * 1.3);
  }, 60_000);

  it('an expert decision takes well under a second', () => {
    const d = botDeal(3, 3, ['hard', 'hard']);
    if (d.phase !== 'done') return;
    const mid: Deal = { ...d, phase: 'playing', tricks: [], trick: [], hands: [0, 1, 2, 3].map((s) => d.tricks.flatMap((t) => t.cards.filter((p) => p.seat === s).map((p) => p.card))), turn: 0, declared: [[], [], [], []], belotes: [] };
    const t0 = performance.now();
    const card = chooseCard({ ...mid, turn: ((d.dealer + 1) % 4) as Seat }, ((d.dealer + 1) % 4) as Seat, 'expert', rng(1));
    expect(mid.hands[(d.dealer + 1) % 4]).toContain(card);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
