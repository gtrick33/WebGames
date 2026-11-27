/**
 * The four pals, one per color. A level's critter 0 is always Tango (tangerine), 1 Sprig (mint), 2 Plum
 * (lilac) and 3 Zest (lemon): a 2-critter level has Tango and Sprig, a 4-critter level all four.
 */
export type ColorId = 0 | 1 | 2 | 3;
export const COLOR_IDS: readonly ColorId[] = [0, 1, 2, 3];

export interface Pal {
  name: string;
  species: 'hamster' | 'cat' | 'bunny' | 'chick';
  color: string;
  /** A darker shade for outlines and shadows. */
  dark: string;
  /** A light shade for highlights. */
  light: string;
  /** The color's name, as players call it. */
  hue: string;
}

export const PALS: Record<ColorId, Pal> = {
  0: { name: 'Tango', species: 'hamster', color: '#ff9447', dark: '#c25a1c', light: '#ffc89a', hue: 'tangerine' },
  1: { name: 'Sprig', species: 'cat', color: '#3fd8a4', dark: '#1d9470', light: '#a8f2d6', hue: 'mint' },
  2: { name: 'Plum', species: 'bunny', color: '#b58cff', dark: '#7650c9', light: '#dcc8ff', hue: 'lilac' },
  3: { name: 'Zest', species: 'chick', color: '#ffd84a', dark: '#c49a12', light: '#fff0a8', hue: 'lemon' },
};

export const isColorId = (v: unknown): v is ColorId => v === 0 || v === 1 || v === 2 || v === 3;
