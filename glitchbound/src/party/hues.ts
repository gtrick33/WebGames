/**
 * Hue Knew?: a board of colours. The cue giver secretly picks one and describes it in a word; the
 * others tap where they think it is. Scored by how close the colours look (perceptual ΔE), not by
 * squares on the board. Pure helpers.
 */
import { deltaE, hsbToRgb, rgbToHex, type Rgb } from '../games/color-recall/color';

export const COLS = 18;
export const ROWS = 10;

/** The colour of a board cell: hue across, pale to deep down. */
export function cellRgb(i: number): Rgb {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const t = row / (ROWS - 1);
  const s = 0.2 + 0.8 * Math.min(1, t * 1.7);
  const b = 1 - 0.68 * Math.max(0, (t - 0.38) / 0.62);
  return hsbToRgb({ h: (col / COLS) * 360, s: s * 100, b: b * 100 });
}
export const cellHex = (i: number): string => rgbToHex(cellRgb(i));

/** Points for a guess, by how different the two colours look. */
export function huePoints(target: number, guess: number): number {
  const d = deltaE(cellRgb(target), cellRgb(guess));
  return d < 6 ? 3 : d < 13 ? 2 : d < 22 ? 1 : 0;
}

/** Four far-apart cells to choose the secret colour from. */
export function offerColours(r: () => number): number[] {
  const out: number[] = [];
  for (let tries = 0; out.length < 4 && tries < 400; tries++) {
    const i = Math.floor(r() * COLS * ROWS);
    if (out.every((j) => deltaE(cellRgb(i), cellRgb(j)) > 30)) out.push(i);
  }
  return out;
}

/** Points per guess, in words. */
export const HUE_GRADES: { points: number; label: string }[] = [
  { points: 3, label: 'spot on' },
  { points: 2, label: 'very close' },
  { points: 1, label: 'close' },
  { points: 0, label: 'too far' },
];
const gradeLabel = (p: number): string => HUE_GRADES.find((g) => g.points === p)?.label ?? 'too far';

/**
 * Why a player scored what they did this round, in words. `cells` are their guesses in order;
 * the cue giver (no guesses) gets a point for each guess anyone placed spot on or very close.
 */
export function explainHues(target: number, cells: number[], cueBonus: number | null): string {
  if (cueBonus !== null) return cueBonus ? `1 point for each spot-on or very close guess (${cueBonus})` : 'no guess landed close enough for a cue point';
  if (!cells.length) return 'no guess this round';
  const nth = ['1st', '2nd', '3rd'];
  return cells.map((c, i) => `${cells.length > 1 ? `${nth[i] ?? `${i + 1}th`} guess ` : ''}${gradeLabel(huePoints(target, c))} (+${huePoints(target, c)})`).join(' · ');
}

/** How many guesses earned the cue giver a point (worth 2 or 3). */
export const cueBonus = (target: number, cells: number[]): number => cells.filter((c) => huePoints(target, c) >= 2).length;
