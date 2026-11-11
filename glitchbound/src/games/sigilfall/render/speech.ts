/**
 * A spoken line as a card over the speaker's head, laid out in screen pixels (render/renderer.ts draws it): the
 * speaker's name, then their words, wrapped to what the screen has room for and never cut short (the old bubble
 * kept three lines of 34 letters and dropped the rest: a tenth of the story's lines lost their end). All of it
 * stays on the screen, clear of the bars along its edges, on a phone held either way.
 */

export interface SpeechCard {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  /** The words' size, the name's, and a line's height. */
  fs: number;
  nameFs: number;
  lineH: number;
  padX: number;
  padY: number;
  /** The baseline of the first line of words. */
  textY: number;
  /** Where its tail points down to the speaker (null when it has been moved off them: it has no one to point at). */
  tailX: number | null;
}

/** How a string is measured: its width at a size and a weight, in the same pixels as the view. */
export type Measure = (text: string, px: number, weight: number) => number;

/** A line of words broken where it must be to fit `maxW`, nothing left out. A word wider than the room keeps its line. */
export function wrapWords(text: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next) > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The words' size on a view: readable on a phone, not shouting on a desk. */
export const speechSize = (viewW: number, viewH: number): number => clamp(Math.min(viewW * 0.034, viewH * 0.037), 12, 15);

/**
 * Lays a line out over a head at (headX, headY). `top` and `bottom` are what the edges of the view keep for
 * themselves (a scene's bars, the HUD's rows), `left` and `right` what its sides do.
 */
export function layoutSpeech(o: { text: string; name: string; headX: number; headY: number; viewW: number; viewH: number; top: number; bottom: number; left?: number; right?: number; measure: Measure }): SpeechCard {
  const fs = speechSize(o.viewW, o.viewH);
  const nameFs = Math.round(fs * 0.82 * 10) / 10;
  const lineH = Math.round(fs * 1.32);
  const padX = Math.round(fs * 0.8);
  const padY = Math.round(fs * 0.6);
  // (what the sides of the view keep for themselves: a phone's stick on the left and its skills on the right, while
  // the hero is playing)
  const left = Math.max(8, o.left ?? 8);
  const right = Math.max(8, o.right ?? 8);
  const room = Math.max(96, Math.min(o.viewW - left - right - padX * 2, fs * 21));
  const lines = wrapWords(o.text, room, (s) => o.measure(s, fs, 600));
  const nameW = o.name ? o.measure(o.name, nameFs, 800) : 0;
  const nameH = o.name ? Math.round(nameFs * 1.35) : 0;
  const wide = Math.max(nameW, ...lines.map((l) => o.measure(l, fs, 600)), fs * 4);
  const w = Math.min(o.viewW - left - right, Math.ceil(wide) + padX * 2);
  const h = padY * 2 + nameH + lines.length * lineH;
  let x = o.headX - w / 2;
  let y = o.headY - 12 - h;
  const x0 = clamp(x, left, Math.max(left, o.viewW - right - w));
  const y0 = clamp(y, o.top + 4, Math.max(o.top + 4, o.viewH - o.bottom - 4 - h - 8));
  const moved = Math.abs(y0 - y) > 1;
  x = x0;
  y = y0;
  const tailX = !moved && o.headX > x + 12 && o.headX < x + w - 12 ? o.headX : null;
  return { x, y, w, h, lines, fs, nameFs, lineH, padX, padY, textY: y + padY + nameH + Math.round(fs * 0.98), tailX };
}
