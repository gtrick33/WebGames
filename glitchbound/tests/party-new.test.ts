import { describe, expect, it } from 'vitest';
import { MYSTERY_WORDS } from '../src/party/content/mystery';
import { SPECTRUMS } from '../src/party/content/spectrums';
import { dialPoints, randomTarget, splitTeams, stealRight } from '../src/party/dial';
import { cellRgb, COLS, cueBonus, explainHues, huePoints, offerColours, ROWS } from '../src/party/hues';
import { checkClues, cleanClue, guessIsRight, rating, stem } from '../src/party/unique';
import { deltaE } from '../src/games/color-recall/color';
import { PARTY_GAMES } from '../src/party/catalog';
import { MODE_IDS } from '../src/party/session';
import { isGameId } from '../rooms/engines';
import { isRoomGame } from '../server/rooms';
import { teamTurns } from '../src/party/engine';
import { screenFacing } from '../src/party/ui/Charades';

const seq = (vals: number[]): (() => number) => {
  let i = 0;
  return () => vals[i++ % vals.length]!;
};

describe('Dial It In', () => {
  it('has original, unique scales that fit under the dial', () => {
    expect(SPECTRUMS.length).toBeGreaterThanOrEqual(100);
    const keys = SPECTRUMS.map(([a, b]) => `${a}|${b}`.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    for (const [a, b] of SPECTRUMS) {
      expect(a.length).toBeLessThanOrEqual(30);
      expect(b.length).toBeLessThanOrEqual(30);
      expect(a).not.toBe(b);
    }
  });

  it('scores by distance from the target', () => {
    expect(dialPoints(50, 50)).toBe(4);
    expect(dialPoints(50, 53)).toBe(4);
    expect(dialPoints(50, 58)).toBe(3);
    expect(dialPoints(50, 36)).toBe(2);
    expect(dialPoints(50, 80)).toBe(0);
    for (const v of [0, 0.5, 0.999]) {
      const t = randomTarget(() => v);
      expect(t).toBeGreaterThanOrEqual(8);
      expect(t).toBeLessThanOrEqual(92);
    }
  });

  it('gives the steal when the other team calls the right side', () => {
    expect(stealRight(30, 50, 'left')).toBe(true);
    expect(stealRight(30, 50, 'right')).toBe(false);
    expect(stealRight(50, 51, 'left')).toBe(false); // a bullseye cannot be stolen
    expect(splitTeams([1, 2, 3, 4, 5])).toEqual([
      [1, 3, 5],
      [2, 4],
    ]);
  });
});

describe('Team turns (Dial It In, Charades)', () => {
  it('alternates the teams and gives both the same number of turns, even 3 against 2', () => {
    expect(teamTurns([['a1', 'a2', 'a3'], ['b1', 'b2']], 1)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b1']);
    const two = teamTurns([['a1', 'a2', 'a3'], ['b1', 'b2']], 2);
    expect(two.filter((p) => p.startsWith('a'))).toHaveLength(6);
    expect(two.filter((p) => p.startsWith('b'))).toHaveLength(6);
    for (let i = 1; i < two.length; i++) expect(two[i]![0]).not.toBe(two[i - 1]![0]);
    expect(teamTurns([['a1', 'a2'], ['b1', 'b2']], 1)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
});

describe('Charades forehead tilt', () => {
  it('reads upright, nodded down and tipped back the same in portrait and landscape', () => {
    // Portrait: beta 90 upright, 180 face down, 0 face up.
    expect(Math.abs(screenFacing(90, 0)!)).toBeLessThan(0.1);
    expect(screenFacing(160, 0)!).toBeLessThan(-0.8);
    expect(screenFacing(20, 0)!).toBeGreaterThan(0.8);
    // Landscape: gamma about ±90 upright; tipping it rolls gamma back towards 0 with beta near 180 or 0.
    expect(Math.abs(screenFacing(0, 88)!)).toBeLessThan(0.1);
    expect(Math.abs(screenFacing(-178, -85)!)).toBeLessThan(0.1);
    expect(screenFacing(175, 20)!).toBeLessThan(-0.8);
    expect(screenFacing(5, -25)!).toBeGreaterThan(0.8);
    expect(screenFacing(null, null)).toBeNull();
  });
});

describe('One of a Kind', () => {
  it('has a clean word list', () => {
    expect(MYSTERY_WORDS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(MYSTERY_WORDS).size).toBe(MYSTERY_WORDS.length);
    for (const w of MYSTERY_WORDS) expect(w).toMatch(/^[a-z]+$/);
  });

  it('matches words loosely: case, accents and simple endings', () => {
    expect(stem('Apples')).toBe(stem('apple'));
    expect(stem('BERRIES')).toBe(stem('berry'));
    expect(stem('boxes')).toBe(stem('box'));
    expect(stem('Café')).toBe('cafe');
    expect(stem('glass')).toBe('glass');
    expect(cleanClue('  big red  thing ')).toBe('big');
  });

  it('cancels twin clues and clues that give the word away', () => {
    const checked = checkClues('dragon', ['fire', 'Fire', 'wings', 'dragons', 'castle', '']);
    expect(checked.map((c) => c.out)).toEqual(['twin', 'twin', null, 'gives-it-away', null, 'empty']);
    expect(checkClues('snowman', ['snow', 'carrot']).map((c) => c.out)).toEqual(['gives-it-away', null]);
  });

  it('checks guesses loosely and rates the final score', () => {
    expect(guessIsRight('rocket', 'Rockets')).toBe(true);
    expect(guessIsRight('rocket', 'rock')).toBe(false);
    expect(guessIsRight('rocket', '')).toBe(false);
    expect(rating(13)).toContain('Perfect');
    expect(rating(0)).toContain('trying');
  });
});

describe('Hue Knew?', () => {
  it('builds a board of distinct colours', () => {
    const hexes = new Set(Array.from({ length: COLS * ROWS }, (_, i) => JSON.stringify(cellRgb(i))));
    expect(hexes.size).toBe(COLS * ROWS);
  });

  it('scores the exact colour 3 and far colours 0', () => {
    expect(huePoints(40, 40)).toBe(3);
    const far = Array.from({ length: COLS * ROWS }, (_, i) => i).find((i) => deltaE(cellRgb(40), cellRgb(i)) > 40)!;
    expect(huePoints(40, far)).toBe(0);
  });

  it('explains every point in words', () => {
    const far = Array.from({ length: COLS * ROWS }, (_, i) => i).find((i) => huePoints(40, i) === 0)!;
    expect(explainHues(40, [40], null)).toBe('spot on (+3)');
    expect(explainHues(40, [40, far], null)).toBe('1st guess spot on (+3) · 2nd guess too far (+0)');
    expect(explainHues(40, [], null)).toBe('no guess this round');
    expect(cueBonus(40, [40, 40, far])).toBe(2);
    expect(explainHues(40, [], 2)).toBe('1 point for each spot-on or very close guess (2)');
    expect(explainHues(40, [], 0)).toContain('no guess landed');
  });

  it('offers four clearly different colours', () => {
    const offer = offerColours(seq([0.1, 0.37, 0.62, 0.88, 0.25, 0.5, 0.75, 0.95]));
    expect(offer).toHaveLength(4);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) expect(deltaE(cellRgb(offer[a]!), cellRgb(offer[b]!))).toBeGreaterThan(30);
  });
});

describe('Party line-up', () => {
  it('lists the new games as pass-the-phone modes and live rooms', () => {
    for (const id of ['dial', 'unique', 'hues'] as const) {
      const g = PARTY_GAMES.find((x) => x.id === id);
      expect(g?.onePhone).toBe(true);
      expect((MODE_IDS as readonly string[]).includes(id)).toBe(true);
      expect(g?.room).toBe(id);
      expect(isGameId(id) && isRoomGame(id)).toBe(true);
      expect(g?.roomPlayers && g.roomBlurb).toBeTruthy();
    }
  });
});
