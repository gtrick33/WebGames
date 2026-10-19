/**
 * Fussbox rules: 81 cards (count × shape × colour × fill), a secret rule as a small logic tree, and a
 * seeded round (rule, four examples, an eight-card exam). Pure and seeded: no React, no DOM, no
 * Math.random, so a seed gives everyone the same round.
 */

/** mulberry32: a tiny deterministic RNG, so a seed gives everyone the same round. */
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

export type Attr = 'count' | 'shape' | 'colour' | 'fill';
export const ATTRS: readonly Attr[] = ['count', 'shape', 'colour', 'fill'];
/** Each attribute has three values, 0–2 (count 0 = one symbol). */
export type Card = Record<Attr, number>;

export const CARD_COUNT = 81;
export const cardId = (c: Card): number => c.count * 27 + c.shape * 9 + c.colour * 3 + c.fill;
export const cardOf = (id: number): Card => ({ count: Math.floor(id / 27) % 3, shape: Math.floor(id / 9) % 3, colour: Math.floor(id / 3) % 3, fill: id % 3 });
export const ALL_CARDS: readonly number[] = Array.from({ length: CARD_COUNT }, (_, i) => i);

/** Corners per symbol: circle 0, triangle 3, square 4. */
const CORNERS = [0, 3, 4];
export const corners = (c: Card): number => (c.count + 1) * CORNERS[c.shape]!;

export type Rule =
  | { t: 'is'; a: Attr; v: number }
  | { t: 'not'; r: Rule }
  | { t: 'and'; l: Rule; r: Rule }
  | { t: 'or'; l: Rule; r: Rule }
  | { t: 'xor'; l: Rule; r: Rule }
  | { t: 'corners'; op: 'atLeast' | 'odd'; n: number };

export function likes(rule: Rule, c: Card): boolean {
  switch (rule.t) {
    case 'is':
      return c[rule.a] === rule.v;
    case 'not':
      return !likes(rule.r, c);
    case 'and':
      return likes(rule.l, c) && likes(rule.r, c);
    case 'or':
      return likes(rule.l, c) || likes(rule.r, c);
    case 'xor':
      return likes(rule.l, c) !== likes(rule.r, c);
    case 'corners':
      return rule.op === 'odd' ? corners(c) % 2 === 1 : corners(c) >= rule.n;
  }
}

export const likedCount = (rule: Rule): number => ALL_CARDS.filter((id) => likes(rule, cardOf(id))).length;

/** Difficulty 1–4. The daily follows the week: Mon–Tue 1, Wed–Thu 2, Fri–Sat 3, Sun 4. */
export type Level = 1 | 2 | 3 | 4;
export function levelFor(day: string): Level {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return dow === 0 ? 4 : dow >= 5 ? 3 : dow >= 3 ? 2 : 1;
}

type Rand = () => number;
const pick = <T>(list: readonly T[], r: Rand): T => list[Math.floor(r() * list.length)]!;

function shuffle<T>(list: readonly T[], r: Rand): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const atom = (a: Attr, r: Rand, negate = 0): Rule => {
  const is: Rule = { t: 'is', a, v: Math.floor(r() * 3) };
  return r() < negate ? { t: 'not', r: is } : is;
};
/** Two different attributes. */
const twoAttrs = (r: Rand): [Attr, Attr] => {
  const [a, b] = shuffle(ATTRS, r);
  return [a!, b!];
};

function makeRule(level: Level, r: Rand): Rule {
  if (level === 1) return atom(pick(ATTRS, r), r, 0.4);
  if (level === 2) {
    const [a, b] = twoAttrs(r);
    return { t: 'and', l: atom(a, r, 0.25), r: atom(b, r, 0.35) };
  }
  if (level === 3) {
    if (r() < 0.25) return r() < 0.5 ? { t: 'corners', op: 'atLeast', n: pick([6, 8], r) } : { t: 'corners', op: 'odd', n: 0 };
    const [a, b] = twoAttrs(r);
    return r() < 0.7 ? { t: 'or', l: atom(a, r, 0.15), r: atom(b, r, 0.15) } : { t: 'and', l: atom(a, r, 1), r: atom(b, r, 1) };
  }
  const roll = r();
  if (roll < 0.4) {
    const [a, b] = twoAttrs(r);
    return { t: 'xor', l: atom(a, r), r: atom(b, r) };
  }
  const [a, b] = twoAttrs(r);
  const c = pick(
    ATTRS.filter((x) => x !== a && x !== b),
    r,
  );
  return roll < 0.7 ? { t: 'and', l: { t: 'or', l: atom(a, r), r: atom(b, r) }, r: atom(c, r, 0.5) } : { t: 'or', l: { t: 'and', l: atom(a, r), r: atom(b, r) }, r: atom(c, r) };
}

/** A rule is fair when it likes some cards and hates some: never all or (nearly) nothing. */
export const fairRule = (rule: Rule): boolean => {
  const n = likedCount(rule);
  return n >= 9 && n <= 70;
};

export interface Round {
  seed: number;
  level: Level;
  rule: Rule;
  /** Two liked and two hated example cards (ids). */
  liked: number[];
  hated: number[];
  /** Eight exam cards (ids), different from the examples, 3–5 of them liked. */
  exam: number[];
}

export const EXAM_SIZE = 8;

export function makeRound(seed: number, level: Level): Round {
  const r = rng(seed);
  let rule = makeRule(level, r);
  for (let tries = 0; !fairRule(rule) && tries < 200; tries++) rule = makeRule(level, r);
  const yes = shuffle(
    ALL_CARDS.filter((id) => likes(rule, cardOf(id))),
    r,
  );
  const no = shuffle(
    ALL_CARDS.filter((id) => !likes(rule, cardOf(id))),
    r,
  );
  const liked = yes.slice(0, 2);
  const hated = no.slice(0, 2);
  const inExam = 3 + Math.floor(r() * 3);
  const exam = shuffle([...yes.slice(2, 2 + inExam), ...no.slice(2, 2 + EXAM_SIZE - inExam)], r);
  return { seed: seed >>> 0, level, rule, liked, hated, exam };
}

/** Today's round: the same everywhere, harder through the week. */
export const dailyRound = (day: string, hash: (s: string) => number): Round => makeRound(hash(`fussbox:${day}`), levelFor(day));

// ------------------------------------------------------------------ scoring

export const BONUS_FREE_TESTS = 3;
export const MAX_BONUS = 200;
/** The most cards you can feed it in one round. */
export const MAX_TESTS = 40;

/** 100 per right exam answer, plus a bonus for cracking it in few tests (scaled by how right you were). */
export function scoreOf(correct: number, tests: number): number {
  const quick = Math.max(0, 1 - Math.max(0, tests - BONUS_FREE_TESTS) / 10);
  return correct * 100 + Math.round(MAX_BONUS * quick * (correct / EXAM_SIZE));
}
export const MAX_SCORE = EXAM_SIZE * 100 + MAX_BONUS;

/** Exam answers marked right. `marks[i]`: true = "it likes it". */
export const correctOf = (round: Round, marks: readonly (boolean | null)[]): number =>
  round.exam.filter((id, i) => marks[i] !== null && marks[i] !== undefined && marks[i] === likes(round.rule, cardOf(id))).length;

/** The spoiler-free share line: 🟩 right, 🟥 wrong, exam order. */
export const resultLine = (round: Round, marks: readonly (boolean | null)[]): string =>
  round.exam.map((id, i) => (marks[i] === likes(round.rule, cardOf(id)) ? '🟩' : '🟥')).join('');
