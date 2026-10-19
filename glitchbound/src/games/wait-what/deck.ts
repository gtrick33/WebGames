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
import { EN, LAUNCH, type HandCat, type Pack } from './pack';
import type { Raw } from './bank/types';

export { LAUNCH, type HandCat, type Pack } from './pack';

/**
 * From this day on, dailies and challenges mix in the newer question styles (the lever, typing,
 * ordering, emoji puzzles and sound). Earlier days keep their original ten questions.
 */
export const FORMATS_SINCE = '2026-10-19';
export const QUIZ_LENGTH = 10;

export type CatId = HandCat | 'odd' | 'world' | 'time' | 'guess' | 'type' | 'emoji' | 'tune' | 'morse';

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
  guess: { label: 'Pull the lever', emoji: '🎚️', color: '#00b4d8' },
  type: { label: 'Type it', emoji: '⌨️', color: '#9d4edd' },
  emoji: { label: 'Emoji puzzle', emoji: '🧩', color: '#ff9f1c' },
  tune: { label: 'Name that tune', emoji: '🎵', color: '#f15bb5' },
  morse: { label: 'Morse code', emoji: '📡', color: '#4361ee' },
};

export const HAND_CATS: HandCat[] = ['history', 'animals', 'science', 'food', 'geo', 'space', 'tech', 'pop', 'sports', 'words', 'money', 'myths'];

/**
 * How a question is answered: pick one of the answers (`choice`), set a number with the lever
 * (`number`), type the answer (`type`), or tap the answers into the right order (`order`).
 */
export type Kind = 'choice' | 'number' | 'type' | 'order';

export interface Question {
  /** Stable id, used to avoid repeats. */
  id: string;
  cat: CatId;
  text: string;
  /** Missing means `choice`. */
  kind?: Kind;
  /** In display order (`type`: the accepted answers, the shown one first; `number`: none). */
  answers: string[];
  /** `choice`: the right answer's index (other kinds: -1). */
  correct: number;
  fact: string;
  /** A row of emoji to decode, shown big. */
  emoji?: string;
  /** Something to listen to first. */
  sound?: { kind: 'tune'; notes: string; bpm: number; spooky?: boolean } | { kind: 'morse'; word: string };
  /** `number`: the lever's range and how close counts. */
  num?: { answer: number; min: number; max: number; step: number; tol: number; near: number; unit?: string };
  /** `order`: answer indexes from first to last. */
  order?: number[];
  /** `number`: how to write numbers ("1,912" / "1 912"); missing = en-US. */
  locale?: string;
}

/** An answer: a choice index (−1 = ran out of time), a number, typed text, or answer indexes in order. */
export type Pick = number | string | number[];

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
function handPool(cat: HandCat, day: string, p: Pack = EN): { id: string; raw: Raw }[] {
  const out: { id: string; raw: Raw }[] = [];
  let n = 0;
  for (const b of p.batches) {
    const items = b.items[cat];
    if (b.since <= day) items.forEach((raw, i) => out.push({ id: `${cat}:${n + i}`, raw }));
    n += items.length;
  }
  return out;
}

/** The fixed order the daily quiz walks a category in: each batch shuffled, batches in release order. */
function dailyOrder(cat: HandCat, day: string, p: Pack): { id: string; raw: Raw }[] {
  const out: { id: string; raw: Raw }[] = [];
  let n = 0;
  for (const b of p.batches) {
    const items = b.items[cat];
    if (b.since <= day) out.push(...shuffle(items.map((raw, i) => ({ id: `${cat}:${n + i}`, raw })), rng(hashString(`ww-order:${cat}:${b.since}`))));
    n += items.length;
  }
  return out;
}

export function fromRaw(id: string, cat: HandCat, raw: Raw, r: Rng, p: Pack = EN): Question {
  const [text, answers, fact] = raw;
  const list = answers.split('|');
  const right = list[0]!;
  // Some answer sets read better in a set order ("True / False").
  const fixed = p.fixedOrder.find((o) => o.length === list.length && o.every((x) => list.includes(x)));
  const shown = fixed ?? shuffle(list, r);
  return { id, cat, text, answers: shown, correct: shown.indexOf(right), fact };
}

// ---------------------------------------------------------------- generated questions

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** "What does X mean?" or "Which word means …?" for a real-but-unlikely English word. */
export function oddWordQuestion(i: number, r: Rng, p: Pack = EN): Question {
  const [word, meaning, group] = p.odd[i]!;
  const others = p.odd.filter((w, j) => j !== i && (!group || w[2] !== group));
  const decoys = shuffle(others, r).slice(0, 3);
  const fact = p.text.realWordFact(capital(word), lower(meaning));
  if (r() < 0.5) {
    const shown = shuffle([meaning, ...decoys.map((d) => d[1])], r);
    return { id: `odd:${i}`, cat: 'odd', text: p.text.whatMeans(word), answers: shown, correct: shown.indexOf(meaning), fact };
  }
  const shown = shuffle([word, ...decoys.map((d) => d[0])], r);
  return { id: `odd:${i}`, cat: 'odd', text: p.text.whichMeans(lower(meaning)), answers: shown, correct: shown.indexOf(word), fact };
}

/** "In German, what does X mean?" for a word with no English equivalent. */
export function worldWordQuestion(i: number, r: Rng, p: Pack = EN): Question {
  const [word, language, meaning] = p.world[i]!;
  const decoys = shuffle(
    p.world.filter((_, j) => j !== i),
    r,
  ).slice(0, 3);
  const shown = shuffle([meaning, ...decoys.map((d) => d[2])], r);
  return {
    id: `world:${i}`,
    cat: 'world',
    text: p.text.worldQuestion(language, word),
    answers: shown,
    correct: shown.indexOf(meaning),
    fact: p.text.worldFact(word, language, lower(meaning)),
  };
}

const margin = (i: number, p: Pack): number => {
  const [year, , , approx] = p.events[i]!;
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
export function fairPair(a: number, b: number, p: Pack = EN): boolean {
  const [ya, , ga] = p.events[a]!;
  const [yb, , gb] = p.events[b]!;
  if (a === b || ya === yb || (ga && ga === gb)) return false;
  const gap = Math.abs(ya - yb);
  return gap > margin(a, p) + margin(b, p) && gap <= span(Math.max(ya, yb));
}

export const yearText = (i: number, p: Pack = EN): string => {
  const [y, , , approx] = p.events[i]!;
  const t = y < 0 ? p.text.bc(-y) : `${y}`;
  return approx ? p.text.around(t) : t;
};

/** A "which came first?" question around event `a` (or, now and then, "which is closer in time?"). */
export function timeQuestion(a: number, r: Rng, avoid: ReadonlySet<number> = new Set(), p: Pack = EN): Question | null {
  const partners = p.events.map((_, j) => j).filter((j) => !avoid.has(j) && fairPair(a, j, p));
  if (partners.length === 0) return null;
  const b = pick(partners, r);
  const [ya, wa] = p.events[a]!;
  const [yb, wb] = p.events[b]!;
  // Closer in time: needs a third event clearly nearer to one of them.
  if (r() < 0.25) {
    const cands = p.events.map((_, j) => j).filter((j) => j !== a && j !== b && !avoid.has(j) && fairPair(a, j, p));
    for (const c of shuffle(cands, r).slice(0, 12)) {
      const [yc, wc] = p.events[c]!;
      const db = Math.abs(ya - yb);
      const dc = Math.abs(ya - yc);
      if (Math.max(db, dc) < Math.min(db, dc) * 1.3 + margin(b, p) + margin(c, p) + margin(a, p)) continue;
      const near = db < dc ? wb : wc;
      const shown = shuffle([wb, wc], r);
      return {
        id: `near:${a}:${Math.min(b, c)}:${Math.max(b, c)}`,
        cat: 'time',
        text: p.text.closer(wa),
        answers: shown,
        correct: shown.indexOf(near),
        fact: `${capital(wa)}: ${yearText(a, p)}. ${capital(wb)}: ${yearText(b, p)}. ${capital(wc)}: ${yearText(c, p)}.`,
      };
    }
  }
  const first = ya < yb ? wa : wb;
  const shown = shuffle([wa, wb], r);
  return {
    id: `time:${Math.min(a, b)}:${Math.max(a, b)}`,
    cat: 'time',
    text: p.text.whichFirst,
    answers: shown,
    correct: shown.indexOf(first),
    fact: `${capital(wa)}: ${yearText(a, p)}. ${capital(wb)}: ${yearText(b, p)}. ${apart(a, b, p)}`,
  };
}

function apart(a: number, b: number, p: Pack): string {
  const gap = Math.abs(p.events[a]![0] - p.events[b]![0]);
  const rough = !!(p.events[a]![3] || p.events[b]![3]);
  return gap === 1 ? p.text.oneYearApart : p.text.yearsApart(gap.toLocaleString(p.locale), rough);
}

function anyTimeQuestion(r: Rng, avoid: ReadonlySet<number> = new Set(), p: Pack = EN): Question {
  for (let tries = 0; tries < 50; tries++) {
    const a = Math.floor(r() * p.events.length);
    if (avoid.has(a)) continue;
    const q = timeQuestion(a, r, avoid, p);
    if (q) return q;
  }
  return timeQuestion(p.events.findIndex((e) => e[0] === 1912), r, new Set(), p)!;
}


// ---------------------------------------------------------------- newer question styles

/**
 * Where the lever starts: the middle of its range, or (when the answer is near the middle) a quarter
 * of the way in from the side farther from the answer. Leaving it alone never scores.
 */
export function leverStart(q: Question): number {
  const n = q.num!;
  const snap = (v: number): number => Math.min(n.max, Math.max(n.min, Math.round((v - n.min) / n.step) * n.step + n.min));
  const mid = snap((n.min + n.max) / 2);
  if (Math.abs(mid - n.answer) > n.near) return mid;
  const low = snap(n.min + (n.max - n.min) / 4);
  const high = snap(n.max - (n.max - n.min) / 4);
  return Math.abs(low - n.answer) > Math.abs(high - n.answer) ? low : high;
}

/** Lever question from the hand-written numbers. */
export function numberQuestion(i: number, p: Pack = EN): Question {
  const n = p.numbers[i]!;
  return { id: `num:${i}`, cat: 'guess', kind: 'number', text: n.q, answers: [], correct: -1, fact: n.fact, locale: p.locale, num: { answer: n.answer, min: n.min, max: n.max, step: n.step, tol: n.tol, near: n.near, unit: n.unit } };
}

/** Events that make good "in what year?" lever questions: dated exactly, from 1500 on (the same in every language). */
export const YEAR_EVENTS = EN.events.map((e, i) => ({ e, i })).filter(({ e }) => !e[3] && e[0] >= 1500).map(({ i }) => i);

/** "In what year …?" on the lever. The range depends on the era, never on the answer. */
export function yearQuestion(i: number, p: Pack = EN): Question {
  const [year, what] = p.events[i]!;
  const [min, max, tol, near] = year >= 1900 ? [1900, 2026, 1, 12] : year >= 1800 ? [1750, 1950, 2, 20] : [1450, 1850, 5, 50];
  return {
    id: `year:${i}`,
    cat: 'guess',
    kind: 'number',
    text: p.text.inWhatYear(capital(what)),
    answers: [],
    correct: -1,
    fact: `${capital(what)}: ${year}.`,
    num: { answer: year, min, max, step: 1, tol, near, unit: '' },
  };
}

export function typedQuestion(i: number, p: Pack = EN): Question {
  const [text, accepted, fact] = p.typed[i]!;
  return { id: `type:${i}`, cat: 'type', kind: 'type', text, answers: accepted.split('|'), correct: -1, fact };
}

export function emojiQuestion(list: 'film' | 'say', i: number, r: Rng, p: Pack = EN): Question {
  const [emoji, answers, fact] = (list === 'film' ? p.emojiTitles : p.emojiSayings)[i]!;
  const all = answers.split('|');
  const shown = shuffle(all, r);
  return { id: `emoji:${list}:${i}`, cat: 'emoji', text: list === 'film' ? p.text.whichFilm : p.text.whichSaying, emoji, answers: shown, correct: shown.indexOf(all[0]!), fact };
}

export function tuneQuestion(i: number, r: Rng, p: Pack = EN): Question {
  const t = p.tunes[i]!;
  const decoys = shuffle(
    p.tunes.filter((_, j) => j !== i),
    r,
  )
    .slice(0, 3)
    .map((x) => x.name);
  const shown = shuffle([t.name, ...decoys], r);
  return { id: `tune:${i}`, cat: 'tune', text: p.text.whichTune, sound: { kind: 'tune', notes: t.notes, bpm: t.bpm, spooky: t.spooky }, answers: shown, correct: shown.indexOf(t.name), fact: t.fact };
}

/** Short words to send in Morse (decoys have the same length). */
export const MORSE_WORDS = ['SOS', 'BOO', 'CAT', 'DOG', 'YES', 'BAT', 'SUN', 'TEA', 'OWL', 'ZOO', 'HI', 'NO', 'OK', 'GO', 'UP', 'MOON', 'HELP', 'CAKE', 'STAR', 'BONE', 'FROG', 'GHOST', 'WITCH', 'MAGIC', 'PIZZA', 'SKULL'];

export function morseQuestion(i: number, r: Rng, p: Pack = EN): Question {
  const word = MORSE_WORDS[i]!;
  const decoys = shuffle(
    MORSE_WORDS.filter((w) => w !== word && w.length === word.length),
    r,
  ).slice(0, 3);
  const shown = shuffle([word, ...decoys], r);
  const spelled = [...word].map((ch) => `${ch} ${MORSE[ch]!.replace(/\./g, '·').replace(/-/g, '−')}`).join(' · ');
  return {
    id: `morse:${i}`,
    cat: 'morse',
    text: p.text.morseQuestion,
    sound: { kind: 'morse', word },
    answers: shown,
    correct: shown.indexOf(word),
    fact: `${spelled}. ${p.text.morseFact}`,
  };
}

/** Morse code for the letters used above (the game's sound module has the full table). */
const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

/** Whether two events are clearly apart (beyond their date margins, and not one story). */
function apartEnough(a: number, b: number, p: Pack): boolean {
  const [ya, , ga] = p.events[a]!;
  const [yb, , gb] = p.events[b]!;
  return a !== b && !(ga && ga === gb) && Math.abs(ya - yb) > margin(a, p) + margin(b, p) + 2;
}

/** "Put these in order": four events near each other in time, tapped oldest first. */
export function orderQuestion(r: Rng, avoid: ReadonlySet<number> = new Set(), p: Pack = EN): Question {
  for (let tries = 0; tries < 80; tries++) {
    const a = Math.floor(r() * p.events.length);
    if (avoid.has(a)) continue;
    const pool = shuffle(
      p.events.map((_, j) => j).filter((j) => !avoid.has(j) && fairPair(a, j, p)),
      r,
    );
    const set = [a];
    for (const j of pool) if (set.length < 4 && set.every((x) => apartEnough(x, j, p))) set.push(j);
    if (set.length < 4) continue;
    const shown = shuffle(set, r);
    const order = [...shown.keys()].sort((x, y) => p.events[shown[x]!]![0] - p.events[shown[y]!]![0]);
    return {
      id: `order:${[...set].sort((x, y) => x - y).join(':')}`,
      cat: 'time',
      kind: 'order',
      text: p.text.putInOrder,
      answers: shown.map((i) => capital(p.events[i]![1])),
      correct: -1,
      order,
      fact: order.map((k) => `${capital(p.events[shown[k]!]![1])} (${yearText(shown[k]!, p)})`).join(' → '),
    };
  }
  throw new Error('no order question');
}

// ---------------------------------------------------------------- answering

/** Lowercase, no accents, punctuation, leading article or extra spaces: for comparing typed answers (any alphabet). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/^\s*(the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

/** Whether a typed answer matches one of the accepted ones, forgiving a typo in longer words. */
export function typedMatches(input: string, accepted: readonly string[]): boolean {
  const got = normalize(input);
  if (!got) return false;
  return accepted.some((a) => {
    const want = normalize(a);
    const slack = want.length >= 9 ? 2 : want.length >= 5 ? 1 : 0;
    return got === want || editDistance(got, want) <= slack;
  });
}

export type Verdict = 'right' | 'close' | 'wrong' | 'timeout';

/** How an answer did. `close`: some points (a near guess on the lever, one swap in an order). */
export function judge(q: Question, pick: Pick | undefined): Verdict {
  if (pick === undefined || pick === -1) return 'timeout';
  switch (q.kind ?? 'choice') {
    case 'number': {
      const n = q.num!;
      const off = Math.abs(Number(pick) - n.answer);
      return off <= n.tol + 1e-9 ? 'right' : off <= n.near + 1e-9 ? 'close' : 'wrong';
    }
    case 'type':
      return typeof pick === 'string' && typedMatches(pick, q.answers) ? 'right' : 'wrong';
    case 'order': {
      if (!Array.isArray(pick) || !q.order || pick.length !== q.order.length) return 'wrong';
      const want = q.order;
      let swaps = 0;
      for (let i = 0; i < pick.length; i++) for (let j = i + 1; j < pick.length; j++) if (want.indexOf(pick[i]!) > want.indexOf(pick[j]!)) swaps++;
      return swaps === 0 ? 'right' : swaps === 1 ? 'close' : 'wrong';
    }
    default:
      return pick === q.correct ? 'right' : 'wrong';
  }
}

/** Points for an answer: 100 plus up to 50 for speed when right; a near miss earns 25–75 (order: 50). */
export function scorePick(q: Question, pick: Pick | undefined, seconds: number, limit: number): number {
  const v = judge(q, pick);
  if (v === 'right') return points(true, seconds, limit);
  if (v !== 'close') return 0;
  if (q.kind === 'number' && q.num) {
    const off = Math.abs(Number(pick) - q.num.answer);
    return Math.round(25 + 50 * (1 - (off - q.num.tol) / Math.max(1e-9, q.num.near - q.num.tol)));
  }
  return 50;
}

/** A number as the lever shows it ("1,912", "4.5 L"). */
export function numberText(q: Question, value: number): string {
  const n = q.num;
  const digits = n && n.step < 1 ? 1 : 0;
  const shown = n?.unit === '' ? String(value) : value.toLocaleString(q.locale ?? 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return n?.unit ? `${shown} ${n.unit}` : shown;
}

/** The right answer as text. */
export function answerText(q: Question): string {
  switch (q.kind ?? 'choice') {
    case 'number':
      return numberText(q, q.num!.answer);
    case 'type':
      return q.answers[0]!;
    case 'order':
      return q.order!.map((i) => q.answers[i]).join(' → ');
    default:
      return q.answers[q.correct]!;
  }
}

/** What the player answered, as text. */
export function pickText(q: Question, pick: Pick): string {
  if (pick === -1) return '';
  switch (q.kind ?? 'choice') {
    case 'number':
      return numberText(q, Number(pick));
    case 'type':
      return String(pick);
    case 'order':
      return Array.isArray(pick) ? pick.map((i) => q.answers[i]).join(' → ') : '';
    default:
      return q.answers[Number(pick)] ?? '';
  }
}

// ---------------------------------------------------------------- decks

/**
 * The order the daily quiz walks the hand-written bank in: every category shuffled, then all of them
 * interleaved evenly by size, so each day mixes categories and nothing repeats until the bank is used up.
 */
function dailySequence(day: string, p: Pack): { id: string; cat: HandCat; raw: Raw }[] {
  const keyed: { key: number; id: string; cat: HandCat; raw: Raw }[] = [];
  for (const cat of HAND_CATS) {
    const order = dailyOrder(cat, day, p);
    const offset = (hashString(`ww-offset:${cat}`) % 1000) / 1000;
    order.forEach((x, j) => keyed.push({ key: (j + offset) / order.length, cat, ...x }));
  }
  return keyed.sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));
}

/** A fixed shuffled order of 0…n−1 (each list walks its own, so nothing repeats until it runs out). */
const orderOf = (n: number, name: string): number[] =>
  shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng(hashString(`ww-order:${name}`)),
  );

/** Halloween week: the daily's sound question is a spooky tune. */
const spookyDay = (day: string): boolean => day.slice(5) >= '10-25' && day.slice(5) <= '10-31';

/**
 * Today's ten questions. From FORMATS_SINCE: 6 hand-written, 1 word, 1 lever (a number or a year),
 * 1 timeline (which came first, or put four in order) and 1 special that rotates daily between a
 * tune, an emoji puzzle, a typed answer and Morse code. Before that: 8 hand-written, 1 word, 1 timeline.
 */
export function dailyQuiz(day: string, p: Pack = EN): Question[] {
  if (day < FORMATS_SINCE) return firstDailies(day, p);
  const k = daysBetween(LAUNCH, day);
  const k0 = daysBetween(LAUNCH, FORMATS_SINCE);
  const r = rng(hashString(`ww-day:${day}`));
  const seq = dailySequence(day, p);
  const base = k0 * 8 + (k - k0) * 6;
  const qs: Question[] = [];
  for (let i = 0; i < 6; i++) {
    const { id, cat, raw } = seq[(base + i) % seq.length]!;
    qs.push(fromRaw(id, cat, raw, r, p));
  }
  qs.push(k % 3 === 2 ? worldWordQuestion(orderOf(p.world.length, 'world')[Math.floor(k / 3) % p.world.length]!, r, p) : oddWordQuestion(orderOf(p.odd.length, 'odd')[(k - Math.floor(k / 3)) % p.odd.length]!, r, p));
  const half = Math.floor(k / 2);
  qs.push(k % 2 === 0 ? numberQuestion(orderOf(p.numbers.length, 'num')[half % p.numbers.length]!, p) : yearQuestion(YEAR_EVENTS[orderOf(YEAR_EVENTS.length, 'year')[half % YEAR_EVENTS.length]!]!, p));
  const year = qs[qs.length - 1]!.id.startsWith('year:') ? new Set([Number(qs[qs.length - 1]!.id.slice(5))]) : new Set<number>();
  qs.push(k % 2 === 0 ? orderQuestion(r, year, p) : anyTimeQuestion(r, year, p));
  const quarter = Math.floor(k / 4);
  switch (k % 4) {
    case 0: {
      // Spooky tunes are saved for Halloween week; the rest take turns the other days.
      const pool = p.tunes.map((t, i) => ({ t, i })).filter(({ t }) => !!t.spooky === spookyDay(day));
      const order = orderOf(pool.length, spookyDay(day) ? 'tune-spooky' : 'tune');
      qs.push(tuneQuestion(pool[order[quarter % pool.length]!]!.i, r, p));
      break;
    }
    case 1: {
      const films = orderOf(p.emojiTitles.length, 'emoji-film');
      const sayings = orderOf(p.emojiSayings.length, 'emoji-say');
      qs.push(quarter % 3 === 2 ? emojiQuestion('say', sayings[Math.floor(quarter / 3) % sayings.length]!, r, p) : emojiQuestion('film', films[(quarter - Math.floor(quarter / 3)) % films.length]!, r, p));
      break;
    }
    case 2:
      qs.push(typedQuestion(orderOf(p.typed.length, 'typed')[quarter % p.typed.length]!, p));
      break;
    default:
      qs.push(morseQuestion(orderOf(MORSE_WORDS.length, 'morse')[quarter % MORSE_WORDS.length]!, r, p));
  }
  return shuffle(qs, r);
}

/** The original mix (before FORMATS_SINCE): 8 hand-written, 1 word, 1 "which came first?". */
function firstDailies(day: string, p: Pack): Question[] {
  const k = Math.max(0, daysBetween(LAUNCH, day));
  const r = rng(hashString(`ww-day:${day}`));
  const seq = dailySequence(day, p);
  const qs: Question[] = [];
  for (let i = 0; i < 8; i++) {
    const { id, cat, raw } = seq[(k * 8 + i) % seq.length]!;
    qs.push(fromRaw(id, cat, raw, r, p));
  }
  const words = shuffle(
    p.odd.map((_, i) => i),
    rng(hashString('ww-order:odd')),
  );
  const world = shuffle(
    p.world.map((_, i) => i),
    rng(hashString('ww-order:world')),
  );
  qs.push(k % 3 === 2 ? worldWordQuestion(world[Math.floor(k / 3) % world.length]!, r, p) : oddWordQuestion(words[(k - Math.floor(k / 3)) % words.length]!, r, p));
  qs.push(anyTimeQuestion(r, new Set(), p));
  return shuffle(qs, r);
}

/** A challenge round: the same ten questions for everyone with this seed (the daily's mix of styles). */
export function challengeQuiz(seed: number, day: string, p: Pack = EN): Question[] {
  if (!day || day < FORMATS_SINCE) return firstChallenges(seed, day, p);
  const r = rng(seed ^ 0x5eed);
  const qs: Question[] = shuffle(HAND_CATS, r)
    .slice(0, 6)
    .map((cat) => {
      const { id, raw } = pick(handPool(cat, day, p), r);
      return fromRaw(id, cat, raw, r, p);
    });
  qs.push(r() < 0.7 ? oddWordQuestion(Math.floor(r() * p.odd.length), r, p) : worldWordQuestion(Math.floor(r() * p.world.length), r, p));
  const lever = r() < 0.5 ? numberQuestion(Math.floor(r() * p.numbers.length), p) : yearQuestion(pick(YEAR_EVENTS, r), p);
  qs.push(lever);
  const used = lever.id.startsWith('year:') ? new Set([Number(lever.id.slice(5))]) : new Set<number>();
  qs.push(r() < 0.5 ? orderQuestion(r, used, p) : anyTimeQuestion(r, used, p));
  qs.push(special(Math.floor(r() * 4), r, p));
  return shuffle(qs, r);
}

/** One of the special styles: 0 tune, 1 emoji, 2 typed, 3 Morse (random item). */
function special(which: number, r: Rng, p: Pack): Question {
  if (which === 0) return tuneQuestion(Math.floor(r() * p.tunes.length), r, p);
  if (which === 1) return r() < 0.7 ? emojiQuestion('film', Math.floor(r() * p.emojiTitles.length), r, p) : emojiQuestion('say', Math.floor(r() * p.emojiSayings.length), r, p);
  if (which === 2) return typedQuestion(Math.floor(r() * p.typed.length), p);
  return morseQuestion(Math.floor(r() * MORSE_WORDS.length), r, p);
}

function firstChallenges(seed: number, day: string, p: Pack): Question[] {
  const r = rng(seed ^ 0x5eed);
  const on = day || '9999-12-31';
  const qs: Question[] = shuffle(HAND_CATS, r)
    .slice(0, 8)
    .map((cat) => {
      const pool = handPool(cat, on, p);
      const { id, raw } = pick(pool, r);
      return fromRaw(id, cat, raw, r, p);
    });
  qs.push(r() < 0.7 ? oddWordQuestion(Math.floor(r() * p.odd.length), r, p) : worldWordQuestion(Math.floor(r() * p.world.length), r, p));
  qs.push(anyTimeQuestion(r, new Set(), p));
  return shuffle(qs, r);
}

/** Total number of different questions (timeline pairs and orders not counted). */
export function bankSize(day = '9999-12-31', p: Pack = EN): number {
  const hand = HAND_CATS.reduce((n, c) => n + handPool(c, day, p).length, 0) + p.odd.length + p.world.length;
  return day < FORMATS_SINCE ? hand : hand + p.numbers.length + YEAR_EVENTS.length + p.typed.length + p.emojiTitles.length + p.emojiSayings.length + p.tunes.length + MORSE_WORDS.length;
}

/**
 * Endless mode: deals one question at a time, never repeating one you have seen (across sessions,
 * via `seen`) until a whole category runs out. Every fourth question is a word or timeline one.
 */
/** Ids of generated (not hand-written choice) questions. */
export const GENERATED = /^(odd|world|time|near|order|num|year|type|emoji|tune|morse):/;

export class EndlessDealer {
  private readonly r: Rng;
  private readonly seen: Set<string>;
  private readonly usedEvents = new Set<number>();
  private recent: CatId[] = [];
  private n = 0;

  constructor(
    seen: Iterable<string>,
    seed = (Math.random() * 2 ** 32) >>> 0,
    private readonly p: Pack = EN,
  ) {
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
      const fresh = handPool(cat, today, this.p).filter((x) => !this.seen.has(x.id));
      if (fresh.length) {
        const { id, raw } = pick(fresh, this.r);
        return fromRaw(id, cat, raw, this.r, this.p);
      }
    }
    // Seen everything: start the hand-written bank over.
    for (const id of [...this.seen]) if (!GENERATED.test(id)) this.seen.delete(id);
    return this.hand();
  }

  /** Generated questions cycle through every style, so a run keeps changing pace. */
  private static readonly STYLES = ['time', 'num', 'tune', 'odd', 'emoji', 'order', 'type', 'year', 'world', 'morse', 'time', 'odd'] as const;

  private generated(): Question {
    const kind = EndlessDealer.STYLES[(this.n / 4 - 1) % EndlessDealer.STYLES.length]!;
    if (kind === 'time' || kind === 'order') {
      const q = kind === 'time' ? anyTimeQuestion(this.r, this.usedEvents, this.p) : orderQuestion(this.r, this.usedEvents, this.p);
      for (const m of q.id.split(':').slice(1)) this.usedEvents.add(Number(m));
      return q;
    }
    if (kind !== 'odd' && kind !== 'world') {
      const [size, idOf, make] = this.style(kind);
      let fresh = Array.from({ length: size }, (_, i) => i).filter((i) => !this.seen.has(idOf(i)));
      if (fresh.length === 0) {
        for (let i = 0; i < size; i++) this.seen.delete(idOf(i));
        fresh = Array.from({ length: size }, (_, i) => i);
      }
      return make(pick(fresh, this.r));
    }
    const list = kind === 'odd' ? this.p.odd : this.p.world;
    let fresh = list.map((_, i) => i).filter((i) => !this.seen.has(`${kind}:${i}`));
    if (fresh.length === 0) {
      for (let i = 0; i < list.length; i++) this.seen.delete(`${kind}:${i}`);
      fresh = list.map((_, i) => i);
    }
    const i = pick(fresh, this.r);
    return kind === 'odd' ? oddWordQuestion(i, this.r, this.p) : worldWordQuestion(i, this.r, this.p);
  }

  /** How many questions a style has, question i's id, and how to make it. */
  private style(kind: 'num' | 'tune' | 'emoji' | 'type' | 'year' | 'morse'): [number, (i: number) => string, (i: number) => Question] {
    const r = this.r;
    const p = this.p;
    const films = p.emojiTitles.length;
    switch (kind) {
      case 'num':
        return [p.numbers.length, (i) => `num:${i}`, (i) => numberQuestion(i, p)];
      case 'year':
        return [YEAR_EVENTS.length, (i) => `year:${YEAR_EVENTS[i]}`, (i) => yearQuestion(YEAR_EVENTS[i]!, p)];
      case 'tune':
        return [p.tunes.length, (i) => `tune:${i}`, (i) => tuneQuestion(i, r, p)];
      case 'emoji':
        return [films + p.emojiSayings.length, (i) => (i < films ? `emoji:film:${i}` : `emoji:say:${i - films}`), (i) => (i < films ? emojiQuestion('film', i, r, p) : emojiQuestion('say', i - films, r, p))];
      case 'type':
        return [p.typed.length, (i) => `type:${i}`, (i) => typedQuestion(i, p)];
      default:
        return [MORSE_WORDS.length, (i) => `morse:${i}`, (i) => morseQuestion(i, r, p)];
    }
  }
}

// ---------------------------------------------------------------- scoring

/** Seconds to answer: a bit less for two-answer questions, more for listening, typing and the lever. */
export function timeLimit(q: Question): number {
  if (q.sound) return 30;
  if (q.kind === 'type' || q.kind === 'order') return 30;
  if (q.kind === 'number') return 25;
  return q.answers.length <= 2 ? 15 : 20;
}

/** Points for an answer: 100 if right, plus up to 50 for speed. */
export function points(right: boolean, seconds: number, limit: number): number {
  if (!right) return 0;
  return 100 + Math.round(50 * Math.max(0, Math.min(1, (limit - seconds) / limit)));
}

export const MAX_POINTS = QUIZ_LENGTH * 150;

export function dailyNumber(day: string): number {
  return daysBetween(LAUNCH, day) + 1;
}
