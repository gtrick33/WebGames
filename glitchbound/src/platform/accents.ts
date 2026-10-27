import type { Accent } from '../catalog/types';

/** Each game accent as the two colors of a picture card's background (browser cards and link previews). */
export const CARD_ACCENTS: Record<Accent, [string, string]> = {
  cyan: ['#2ad1f0', '#3d5bff'],
  magenta: ['#ff4fc8', '#7b4dff'],
  blue: ['#3d5bff', '#2ad1f0'],
  orange: ['#ff6a1a', '#ffc928'],
  lime: ['#b6e62c', '#12c6b3'],
  coral: ['#ff5a6c', '#ff6a1a'],
  yellow: ['#ffc928', '#ff6a1a'],
  teal: ['#12c6b3', '#3d5bff'],
  violet: ['#7b4dff', '#ff4fc8'],
};

/** The ink of cards: outlines, hard shadows and text. */
export const CARD_INK = '#1d1238';
