/**
 * Crosswire play rules: cursor movement, typing, checking, hints, the mystery word and scoring.
 * Pure functions over plain data, unit tested.
 */
import { daysBetween, hashString } from '../../platform/dates';
import { makePuzzle, wordCells, type Dir, type Puzzle, type Size } from './grid';

export const EPOCH = '2026-10-19';
export type Entries = Record<string, string>;
export const key = (r: number, c: number): string => `${r},${c}`;

export function dailyPuzzle(day: string): Puzzle {
  return makePuzzle(hashString(`crosswire:${day}`), 'medium');
}
export const dailyNumber = (day: string): number => Math.max(1, daysBetween(EPOCH, day) + 1);
export const practicePuzzle = (size: Size): Puzzle => makePuzzle((Math.random() * 2 ** 32) >>> 0, size);

/** Words that pass through a letter square. */
export function wordsAt(p: Puzzle, r: number, c: number): number[] {
  const out: number[] = [];
  p.words.forEach((w, i) => {
    if (wordCells(w).some(([wr, wc]) => wr === r && wc === c)) out.push(i);
  });
  return out;
}

/** Picks the word for a tapped square: keep the current direction when possible. */
export function wordFor(p: Puzzle, r: number, c: number, prefer: Dir): number {
  const ws = wordsAt(p, r, c);
  return ws.find((i) => p.words[i]!.dir === prefer) ?? ws[0] ?? 0;
}

export const isFilled = (p: Puzzle, e: Entries, wi: number): boolean => wordCells(p.words[wi]!).every(([r, c]) => !!e[key(r, c)]);
export const isRight = (p: Puzzle, e: Entries, wi: number): boolean => wordCells(p.words[wi]!).every(([r, c]) => e[key(r, c)] === p.words[wi]!.word[wordCells(p.words[wi]!).findIndex(([a, b]) => a === r && b === c)]);

export function allLetters(p: Puzzle): [number, number, string][] {
  const out: [number, number, string][] = [];
  p.cells.forEach((row, r) => row.forEach((cell, c) => cell.kind === 'letter' && out.push([r, c, cell.ch])));
  return out;
}

export const solved = (p: Puzzle, e: Entries): boolean => allLetters(p).every(([r, c, ch]) => e[key(r, c)] === ch);
export const wrongCells = (p: Puzzle, e: Entries): string[] => allLetters(p).filter(([r, c, ch]) => e[key(r, c)] && e[key(r, c)] !== ch).map(([r, c]) => key(r, c));

export interface Cursor {
  word: number;
  /** Index within the word. */
  pos: number;
}

/** Types a letter: fills the square and moves to the next empty square in the word (or the next word). */
export function typeLetter(p: Puzzle, e: Entries, cur: Cursor, ch: string): { entries: Entries; cursor: Cursor } {
  const cells = wordCells(p.words[cur.word]!);
  const [r, c] = cells[cur.pos]!;
  const entries = { ...e, [key(r, c)]: ch.toUpperCase() };
  // Next empty square in this word after the cursor, else the next unfinished word.
  for (let i = cur.pos + 1; i < cells.length; i++) if (!entries[key(...cells[i]!)]) return { entries, cursor: { word: cur.word, pos: i } };
  if (cur.pos + 1 < cells.length) return { entries, cursor: { word: cur.word, pos: cur.pos + 1 } };
  for (let k = 1; k <= p.words.length; k++) {
    const wi = (cur.word + k) % p.words.length;
    const ws = wordCells(p.words[wi]!);
    const empty = ws.findIndex(([a, b]) => !entries[key(a, b)]);
    if (empty >= 0) return { entries, cursor: { word: wi, pos: empty } };
  }
  return { entries, cursor: cur };
}

/** Backspace: clear this square, or step back and clear the previous one. */
export function backspace(p: Puzzle, e: Entries, cur: Cursor): { entries: Entries; cursor: Cursor } {
  const cells = wordCells(p.words[cur.word]!);
  const here = key(...cells[cur.pos]!);
  if (e[here]) {
    const entries = { ...e };
    delete entries[here];
    return { entries, cursor: cur };
  }
  const pos = Math.max(0, cur.pos - 1);
  const entries = { ...e };
  delete entries[key(...cells[pos]!)];
  return { entries, cursor: { word: cur.word, pos } };
}

/** Moves the cursor to the same square in the crossing word, if any. */
export function toggleDir(p: Puzzle, cur: Cursor): Cursor {
  const [r, c] = wordCells(p.words[cur.word]!)[cur.pos]!;
  const other = wordsAt(p, r, c).find((i) => i !== cur.word);
  if (other === undefined) return cur;
  return { word: other, pos: wordCells(p.words[other]!).findIndex(([a, b]) => a === r && b === c) };
}

export interface Tally {
  seconds: number;
  checks: number;
  letterHints: number;
  wordHints: number;
  mystery: boolean;
  /** Words (indexes into the puzzle's words) that got a letter hint, and words revealed whole. */
  hinted?: number[];
  revealed?: number[];
}

/** Notes a hint on word `wi` in the tally. */
export function withHint(t: Tally, wi: number, kind: 'letter' | 'word'): Tally {
  if (kind === 'word') return { ...t, wordHints: t.wordHints + 1, revealed: [...new Set([...(t.revealed ?? []), wi])] };
  return { ...t, letterHints: t.letterHints + 1, hinted: [...new Set([...(t.hinted ?? []), wi])] };
}

/**
 * Spoiler-free result: a square per word, 8 to a row (🟩 solved alone, 🟨 with a letter hint, 🟥
 * revealed), and ⭐ when the mystery word was solved too.
 */
export function resultLine(p: Pick<Puzzle, 'words' | 'mystery'>, t: Tally): string {
  const squares = p.words.map((_, i) => (t.revealed?.includes(i) ? '🟥' : t.hinted?.includes(i) ? '🟨' : '🟩'));
  const rows: string[] = [];
  for (let i = 0; i < squares.length; i += 8) rows.push(squares.slice(i, i + 8).join(''));
  if (p.mystery && t.mystery) rows[rows.length - 1] += ' ⭐';
  return rows.join('\n');
}

export const LETTER_HINT = 30;
export const WORD_HINT = 100;
export const MYSTERY_BONUS = 250;

/** 1000 for a clean solve, minus time (1 per 3 s after the first minute), help, plus the mystery bonus. */
export function score(t: Tally): number {
  const time = Math.max(0, Math.floor((t.seconds - 60) / 3));
  return Math.max(100, 1000 - time - t.checks * 10 - t.letterHints * LETTER_HINT - t.wordHints * WORD_HINT) + (t.mystery ? MYSTERY_BONUS : 0);
}

/** The circled letters of the mystery word, shuffled (never in the answer's order). */
export function mysteryTiles(p: Puzzle): string[] {
  if (!p.mystery) return [];
  const w = p.mystery.word.split('');
  const r = (n: number): number => (hashString(`${p.seed}:${n}`) % 1000) / 1000;
  const out = [...w].sort((a, b) => r(a.charCodeAt(0) + w.indexOf(a)) - r(b.charCodeAt(0) + w.indexOf(b)));
  return out.join('') === p.mystery.word ? [...out.slice(1), out[0]!] : out;
}
