/**
 * Wait, What? question decks. Hand-written questions come from bank/*, plus generated ones: real
 * words that sound made up, untranslatable words from other languages, and "which came first?".
 *
 * - The daily quiz walks the whole bank in a fixed shuffled order, so a daily player does not see a
 *   question again until it has all gone by (about two months, more as the bank grows).
 * - A challenge round is picked from its seed, so every player gets the same ten questions.
 * - Endless never repeats a question until you have seen the whole bank (seen ids are saved).
 *
 * Content added later goes in a new batch with a `since` date after its release, so dailies and
 * challenges from before then keep their questions.
 */
import { daysBetween, hashString } from '../../platform/dates';
import { ANIMALS } from './bank/animals';
import { FOOD } from './bank/food';
import { GEO } from './bank/geo';
import { HISTORY } from './bank/history';
import { ODD_WORDS, WORLD_WORDS } from './bank/lexicon';
import { MONEY } from './bank/money';
import { MYTHS } from './bank/myths';
import { POP } from './bank/pop';
import { SCIENCE } from './bank/science';
import { SPACE } from './bank/space';
import { SPORTS } from './bank/sports';
import { TECH } from './bank/tech';
import { EVENTS } from './bank/timeline';
import type { Raw } from './bank/types';
import { WORDS } from './bank/words';

export const LAUNCH = '2026-10-18';
export const QUIZ_LENGTH = 10;

export type HandCat = 'history' | 'animals' | 'science' | 'food' | 'geo' | 'space' | 'tech' | 'pop' | 'sports' | 'words' | 'money' | 'myths';
export type CatId = HandCat | 'odd' | 'world' | 'time';

export const CATS: Record<CatId, { label: string; emoji: string; color: string }> = {
  history: { label: 'Weird history', emoji: '🏛️', color: '#c98a52' },
  animals: { label: 'Animals', emoji: '🐙', color: '#ff7a59' },
  science: { label: 'Science & body', emoji: '🧪', color: '#2ec4b6' },
  food: { label: 'Food & drink', emoji: '🍕', color: '#ffb703' },
  geo: { label: 'Geography', emoji: '🗺️', color: '#3a86ff' },
  space: { label: 'Space', emoji: '🚀', color: '#7b4dff' },
  tech: { label: 'Inventions', emoji: '💡', color: '#ffd23f' },
  pop: { label: 'Pop culture', emoji: '🎬', color: '#ff4fc8' },
  sports: { label: 'Sports & games', emoji: '🏆', color: '#38b000' },
  words: { label: 'Words', emoji: '🔤', color: '#8d6bff' },
  money: { label: 'Money', emoji: '💸', color: '#2a9d8f' },
  myths: { label: 'Myth or fact?', emoji: '🕵️', color: '#ef476f' },
  odd: { label: 'Real word?!', emoji: '🤨', color: '#f77f00' },
  world: { label: 'Words of the world', emoji: '🌐', color: '#06aed5' },
  time: { label: 'Timeline', emoji: '⏳', color: '#e76f51' },
};

export const HAND_CATS: HandCat[] = ['history', 'animals', 'science', 'food', 'geo', 'space', 'tech', 'pop', 'sports', 'words', 'money', 'myths'];

/** Batches of hand-written questions, appended in release order. */
const BATCHES: { since: string; items: Record<HandCat, Raw[]> }[] = [
  {
    since: LAUNCH,
    items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
  },
];

export interface Question {
  /** Stable id, used to avoid repeats. */
  id: string;
  cat: CatId;
  text: string;
  /** In display order. */
  answers: string[];
  correct: number;
  fact: string;
}

export type Rng = () => number;

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], r: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const pick = <T>(list: readonly T[], r: Rng): T => list[Math.floor(r() * list.length)]!;

/** Hand-written questions of one category available on `day`, in id order. */
function handPool(cat: HandCat, day: string): { id: string; raw: Raw }[] {
  const out: { id: string; raw: Raw }[] = [];
  let n = 0;
  for (const b of BATCHES) {
    const items = b.items[cat];
    if (b.since <= day) items.forEach((raw, i) => out.push({ id: `${cat}:${n + i}`, raw }));
    n += items.length;
  }
  return out;
}

/** The fixed order the daily quiz walks a category in: each batch shuffled, batches in release order. */
function dailyOrder(cat: HandCat, day: string): { id: string; raw: Raw }[] {
  const out: { id: string; raw: Raw }[] = [];
  let n = 0;
  for (const b of BATCHES) {
    const items = b.items[cat];
    if (b.since <= day) out.push(...shuffle(items.map((raw, i) => ({ id: `${cat}:${n + i}`, raw })), rng(hashString(`ww-order:${cat}:${b.since}`))));
    n += items.length;
  }
  return out;
}

/** Fixed answers that read better in a set order. */
const FIXED_ORDER = [
  ['True', 'False'],
  ['Myth', 'Fact'],
  ['Yes', 'No'],
];

export function fromRaw(id: string, cat: HandCat, raw: Raw, r: Rng): Question {
  const [text, answers, fact] = raw;
  const list = answers.split('|');
  const right = list[0]!;
  const fixed = FIXED_ORDER.find((o) => o.length === list.length && o.every((x) => list.includes(x)));
  const shown = fixed ?? shuffle(list, r);
  return { id, cat, text, answers: shown, correct: shown.indexOf(right), fact };
}

// ---------------------------------------------------------------- generated questions

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** "What does X mean?" or "Which word means …?" for a real-but-unlikely English word. */
export function oddWordQuestion(i: number, r: Rng): Question {
  const [word, meaning, group] = ODD_WORDS[i]!;
  const others = ODD_WORDS.filter((w, j) => j !== i && (!group || w[2] !== group));
  const decoys = shuffle(others, r).slice(0, 3);
  const fact = `“${capital(word)}” is a real word: ${lower(meaning)}.`;
  if (r() < 0.5) {
    const shown = shuffle([meaning, ...decoys.map((d) => d[1])], r);
    return { id: `odd:${i}`, cat: 'odd', text: `What does “${word}” mean?`, answers: shown, correct: shown.indexOf(meaning), fact };
  }
  const shown = shuffle([word, ...decoys.map((d) => d[0])], r);
  return { id: `odd:${i}`, cat: 'odd', text: `Which real word means “${lower(meaning)}”?`, answers: shown, correct: shown.indexOf(word), fact };
}

/** "In German, what does X mean?" for a word with no English equivalent. */
export function worldWordQuestion(i: number, r: Rng): Question {
  const [word, language, meaning] = WORLD_WORDS[i]!;
  const decoys = shuffle(
    WORLD_WORDS.filter((_, j) => j !== i),
    r,
  ).slice(0, 3);
  const shown = shuffle([meaning, ...decoys.map((d) => d[2])], r);
  return {
    id: `world:${i}`,
    cat: 'world',
    text: `In ${language}, what does “${word}” mean?`,
    answers: shown,
    correct: shown.indexOf(meaning),
    fact: `${word} (${language}): ${lower(meaning)}. English needs a whole sentence for it.`,
  };
}

const margin = (i: number): number => {
  const [year, , , approx] = EVENTS[i]!;
  return approx ? (year < 0 ? 150 : 10) : 0;
};

/** How far apart two events may be and still make a good question (by the later one): close enough to be tricky. */
function span(year: number): number {
  if (year < 0) return 2000;
  if (year < 1500) return 500;
  if (year < 1800) return 120;
  return 35;
}

/** Whether two events make a fair "which came first?" pair. */
export function fairPair(a: number, b: number): boolean {
  const [ya, , ga] = EVENTS[a]!;
  const [yb, , gb] = EVENTS[b]!;
  if (a === b || ya === yb || (ga && ga === gb)) return false;
  const gap = Math.abs(ya - yb);
  return gap > margin(a) + margin(b) && gap <= span(Math.max(ya, yb));
}

export const yearText = (i: number): string => {
  const [y, , , approx] = EVENTS[i]!;
  const t = y < 0 ? `${-y} BC` : `${y}`;
  return approx ? `around ${t}` : t;
};

/** A "which came first?" question around event `a` (or, now and then, "which is closer in time?"). */
export function timeQuestion(a: number, r: Rng, avoid: ReadonlySet<number> = new Set()): Question | null {
  const partners = EVENTS.map((_, j) => j).filter((j) => !avoid.has(j) && fairPair(a, j));
  if (partners.length === 0) return null;
  const b = pick(partners, r);
  const [ya, wa] = EVENTS[a]!;
  const [yb, wb] = EVENTS[b]!;
  // Closer in time: needs a third event clearly nearer to one of them.
  if (r() < 0.25) {
    const cands = EVENTS.map((_, j) => j).filter((j) => j !== a && j !== b && !avoid.has(j) && fairPair(a, j));
    for (const c of shuffle(cands, r).slice(0, 12)) {
      const [yc, wc] = EVENTS[c]!;
      const db = Math.abs(ya - yb);
      const dc = Math.abs(ya - yc);
      if (Math.max(db, dc) < Math.min(db, dc) * 1.3 + margin(b) + margin(c) + margin(a)) continue;
      const near = db < dc ? wb : wc;
      const shown = shuffle([wb, wc], r);
      return {
        id: `near:${a}:${Math.min(b, c)}:${Math.max(b, c)}`,
        cat: 'time',
        text: `Which happened closer in time to this: ${lower(wa)}?`,
        answers: shown,
        correct: shown.indexOf(near),
        fact: `${capital(wa)}: ${yearText(a)}. ${capital(wb)}: ${yearText(b)}. ${capital(wc)}: ${yearText(c)}.`,
      };
    }
  }
  const first = ya < yb ? wa : wb;
  const shown = shuffle([wa, wb], r);
  return {
    id: `time:${Math.min(a, b)}:${Math.max(a, b)}`,
    cat: 'time',
    text: 'Which came first?',
    answers: shown,
    correct: shown.indexOf(first),
    fact: `${capital(wa)}: ${yearText(a)}. ${capital(wb)}: ${yearText(b)}. ${apart(a, b)}`,
  };
}

function apart(a: number, b: number): string {
  const gap = Math.abs(EVENTS[a]![0] - EVENTS[b]![0]);
  const rough = EVENTS[a]![3] || EVENTS[b]![3];
  return gap === 1 ? 'Just one year apart!' : `${rough ? 'Roughly ' : ''}${gap.toLocaleString('en-US')} years apart.`;
}

function anyTimeQuestion(r: Rng, avoid: ReadonlySet<number> = new Set()): Question {
  for (let tries = 0; tries < 50; tries++) {
    const a = Math.floor(r() * EVENTS.length);
    if (avoid.has(a)) continue;
    const q = timeQuestion(a, r, avoid);
    if (q) return q;
  }
  return timeQuestion(EVENTS.findIndex((e) => e[0] === 1912), r)!;
}

// ---------------------------------------------------------------- decks

/**
 * The order the daily quiz walks the hand-written bank in: every category shuffled, then all of them
 * interleaved evenly by size, so each day mixes categories and nothing repeats until the bank is used up.
 */
function dailySequence(day: string): { id: string; cat: HandCat; raw: Raw }[] {
  const keyed: { key: number; id: string; cat: HandCat; raw: Raw }[] = [];
  for (const cat of HAND_CATS) {
    const order = dailyOrder(cat, day);
    const offset = (hashString(`ww-offset:${cat}`) % 1000) / 1000;
    order.forEach((x, j) => keyed.push({ key: (j + offset) / order.length, cat, ...x }));
  }
  return keyed.sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));
}

/** Today's ten questions: 8 hand-written, 1 word, 1 "which came first?". */
export function dailyQuiz(day: string): Question[] {
  const k = Math.max(0, daysBetween(LAUNCH, day));
  const r = rng(hashString(`ww-day:${day}`));
  const seq = dailySequence(day);
  const qs: Question[] = [];
  for (let i = 0; i < 8; i++) {
    const { id, cat, raw } = seq[(k * 8 + i) % seq.length]!;
    qs.push(fromRaw(id, cat, raw, r));
  }
  const words = shuffle(
    ODD_WORDS.map((_, i) => i),
    rng(hashString('ww-order:odd')),
  );
  const world = shuffle(
    WORLD_WORDS.map((_, i) => i),
    rng(hashString('ww-order:world')),
  );
  qs.push(k % 3 === 2 ? worldWordQuestion(world[Math.floor(k / 3) % world.length]!, r) : oddWordQuestion(words[(k - Math.floor(k / 3)) % words.length]!, r));
  qs.push(anyTimeQuestion(r));
  return shuffle(qs, r);
}

/** A challenge round: the same ten questions for everyone with this seed. */
export function challengeQuiz(seed: number, day: string): Question[] {
  const r = rng(seed ^ 0x5eed);
  const on = day || '9999-12-31';
  const qs: Question[] = shuffle(HAND_CATS, r)
    .slice(0, 8)
    .map((cat) => {
      const pool = handPool(cat, on);
      const { id, raw } = pick(pool, r);
      return fromRaw(id, cat, raw, r);
    });
  qs.push(r() < 0.7 ? oddWordQuestion(Math.floor(r() * ODD_WORDS.length), r) : worldWordQuestion(Math.floor(r() * WORLD_WORDS.length), r));
  qs.push(anyTimeQuestion(r));
  return shuffle(qs, r);
}

/** Total number of different hand-written and word questions (timeline pairs not counted). */
export function bankSize(day = '9999-12-31'): number {
  return HAND_CATS.reduce((n, c) => n + handPool(c, day).length, 0) + ODD_WORDS.length + WORLD_WORDS.length;
}

/**
 * Endless mode: deals one question at a time, never repeating one you have seen (across sessions,
 * via `seen`) until a whole category runs out. Every fourth question is a word or timeline one.
 */
export class EndlessDealer {
  private readonly r: Rng;
  private readonly seen: Set<string>;
  private readonly usedEvents = new Set<number>();
  private recent: CatId[] = [];
  private n = 0;

  constructor(seen: Iterable<string>, seed = (Math.random() * 2 ** 32) >>> 0) {
    this.r = rng(seed);
    this.seen = new Set(seen);
  }

  /** Ids seen so far (to save). */
  seenIds(): string[] {
    return [...this.seen];
  }

  next(): Question {
    this.n++;
    const q = this.n % 4 === 0 ? this.generated() : this.hand();
    this.seen.add(q.id);
    this.recent = [q.cat, ...this.recent].slice(0, 4);
    return q;
  }

  private hand(): Question {
    const today = '9999-12-31';
    const cats = shuffle(HAND_CATS, this.r).sort((a, b) => Number(this.recent.includes(a)) - Number(this.recent.includes(b)));
    for (const cat of cats) {
      const fresh = handPool(cat, today).filter((x) => !this.seen.has(x.id));
      if (fresh.length) {
        const { id, raw } = pick(fresh, this.r);
        return fromRaw(id, cat, raw, this.r);
      }
    }
    // Seen everything: start the hand-written bank over.
    for (const id of [...this.seen]) if (!/^(odd|world|time|near):/.test(id)) this.seen.delete(id);
    return this.hand();
  }

  private generated(): Question {
    const kind = this.n % 12 === 0 ? 'world' : this.n % 8 === 0 ? 'time' : this.r() < 0.5 ? 'time' : 'odd';
    if (kind === 'time') {
      const q = anyTimeQuestion(this.r, this.usedEvents);
      for (const m of q.id.split(':').slice(1)) this.usedEvents.add(Number(m));
      return q;
    }
    const list = kind === 'odd' ? ODD_WORDS : WORLD_WORDS;
    let fresh = list.map((_, i) => i).filter((i) => !this.seen.has(`${kind}:${i}`));
    if (fresh.length === 0) {
      for (let i = 0; i < list.length; i++) this.seen.delete(`${kind}:${i}`);
      fresh = list.map((_, i) => i);
    }
    const i = pick(fresh, this.r);
    return kind === 'odd' ? oddWordQuestion(i, this.r) : worldWordQuestion(i, this.r);
  }
}

// ---------------------------------------------------------------- scoring

/** Seconds to answer: a bit less for two-answer questions. */
export const timeLimit = (q: Question): number => (q.answers.length <= 2 ? 15 : 20);

/** Points for an answer: 100 if right, plus up to 50 for speed. */
export function points(right: boolean, seconds: number, limit: number): number {
  if (!right) return 0;
  return 100 + Math.round(50 * Math.max(0, Math.min(1, (limit - seconds) / limit)));
}

export const MAX_POINTS = QUIZ_LENGTH * 150;

export function dailyNumber(day: string): number {
  return daysBetween(LAUNCH, day) + 1;
}
