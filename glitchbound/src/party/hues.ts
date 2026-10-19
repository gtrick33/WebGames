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
