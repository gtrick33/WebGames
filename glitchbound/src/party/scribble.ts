/**
 * Scribble Scramble's shared rules, used by the room (rooms/scribbleRoom.ts) and the phones: the canvas,
 * the paint box, what counts as a right (or nearly right) guess, the word's blanks and the points.
 *
 * Drawings travel as a log of small ops, so every phone replays the same picture at the same size:
 *   [0, color, size, x, y]   pen down          [1, x, y, x, y, …]   pen moves
 *   [2, color, x, y]         fill an area       [3]                  undo the last stroke or fill
 *   [4]                      clear the canvas
 * Coordinates are whole pixels on a W × H canvas (CSS scales it to the screen).
 */
import { TIER_MULT, type Tier } from './content/scribble';

export const W = 800;
export const H = 600;

/** The paint box: bold toy-box colors, plus white for an eraser that also paints over fills. */
export const COLORS = [
  '#1d1238', '#ffffff', '#8a8a99', '#7a4a2a',
  '#ff3b4e', '#ff8a1f', '#ffd21f', '#8ad13b',
  '#1fbf6a', '#12c6b3', '#22a8ff', '#3d5bff',
  '#8b4dff', '#ff5ac8', '#ffb3c7', '#f2d2a9',
] as const;
export const ERASER = 1;
/** Brush widths in canvas pixels. */
export const SIZES = [4, 9, 18, 34] as const;

export type Op = number[];

const inCanvas = (x: unknown, y: unknown): boolean => Number.isInteger(x) && Number.isInteger(y) && (x as number) >= 0 && (x as number) < W && (y as number) >= 0 && (y as number) < H;

/** Whether an op is well formed (the room checks every op it is sent). */
export function validOp(op: unknown): op is Op {
  if (!Array.isArray(op) || op.length === 0) return false;
  const [kind] = op;
  if (kind === 0) return op.length === 5 && Number.isInteger(op[1]) && op[1] >= 0 && op[1] < COLORS.length && Number.isInteger(op[2]) && op[2] >= 0 && op[2] < SIZES.length && inCanvas(op[3], op[4]);
  if (kind === 1) {
    if (op.length < 3 || op.length % 2 === 0 || op.length > 129) return false;
    for (let i = 1; i < op.length; i += 2) if (!inCanvas(op[i], op[i + 1])) return false;
    return true;
  }
  if (kind === 2) return op.length === 4 && Number.isInteger(op[1]) && op[1] >= 0 && op[1] < COLORS.length && inCanvas(op[2], op[3]);
  return (kind === 3 || kind === 4) && op.length === 1;
}

/** One stroke or fill as it ends up on the canvas, after undos and clears. */
export type Mark = { kind: 'stroke'; color: number; size: number; pts: number[] } | { kind: 'fill'; color: number; x: number; y: number };

/** Plays an op log into the marks on the canvas. `into` continues an earlier replay (ops appended since). */
export function replay(ops: readonly Op[], into: Mark[] = []): Mark[] {
  const marks = into;
  for (const op of ops) {
    const kind = op[0];
    if (kind === 0) marks.push({ kind: 'stroke', color: op[1]!, size: op[2]!, pts: [op[3]!, op[4]!] });
    else if (kind === 1) {
      const last = marks[marks.length - 1];
      if (last?.kind === 'stroke') for (let i = 1; i < op.length; i++) last.pts.push(op[i]!);
    } else if (kind === 2) marks.push({ kind: 'fill', color: op[1]!, x: op[2]!, y: op[3]! });
    else if (kind === 3) marks.pop();
    else if (kind === 4) marks.length = 0;
  }
  return marks;
}

/** A guess as compared: lowercase letters and single spaces. */
export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Right, also typed without its spaces ("icecream" for "ice cream") or with a trailing s. */
export function isHit(guess: string, word: string): boolean {
  const g = normalize(guess);
  const w = normalize(word);
  if (!g) return false;
  const tight = (s: string): string => s.replace(/ /g, '');
  return g === w || tight(g) === tight(w) || tight(g) === `${tight(w)}s`;
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

/** One letter off (two for long words): the guesser alone is told they are close. */
export function isNear(guess: string, word: string): boolean {
  const g = normalize(guess).replace(/ /g, '');
  const w = normalize(word).replace(/ /g, '');
  if (w.length < 4 || !g || g === w) return false;
  return distance(g, w) <= (w.length >= 8 ? 2 : 1);
}

/** The word as guessers see it: a blank per letter, spaces kept, hinted letters shown. */
export const mask = (word: string, shown: readonly number[]): string => [...word].map((ch, i) => (ch === ' ' ? ' ' : shown.includes(i) ? ch : '_')).join('');

/** How many letters a hint reveals over a turn: none for short words, more for long ones. */
export const hintCount = (word: string): number => {
  const letters = word.replace(/ /g, '').length;
  return letters <= 3 ? 0 : letters <= 5 ? 1 : letters <= 9 ? 2 : 3;
};

/** Bonus for the first, second and third right guess. */
export const ORDER_BONUS = [50, 25, 10] as const;

/**
 * A right guess: up to 300 for an instant guess, at least 80 at the buzzer, plus the order bonus, all
 * times the word's tier (Easy 1×, Medium 1.5×, Hard 2×).
 */
export function guessPoints(tier: Tier, left: number, clock: number, order: number): number {
  const frac = Math.max(0, Math.min(1, left / clock));
  return Math.round((80 + 220 * frac + (ORDER_BONUS[order] ?? 0)) * TIER_MULT[tier]);
}

/** The drawer: up to 200 (times the tier) when everyone gets it, by the share of guessers who did. */
export const drawerPoints = (tier: Tier, hits: number, guessers: number): number => (guessers > 0 ? Math.round((200 * hits * TIER_MULT[tier]) / guessers) : 0);
