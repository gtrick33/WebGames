/**
 * What the room needs to know about the levels without their maps (the rooms worker bundles room.ts and
 * this, never levels.ts): how many critters each level has, its par time and gem count, and the score.
 * tests/prism-pals-levels checks LEVEL_META against the maps.
 */

/** Per level: [critters, par seconds, gems]. */
export const LEVEL_META: readonly (readonly [number, number, number])[] = [
  [2, 14, 4], [2, 18, 4], [2, 24, 4], [2, 30, 4], [2, 24, 4], [2, 30, 5], [2, 32, 2], [2, 34, 4],
  [3, 20, 6], [3, 36, 7], [3, 40, 6], [3, 34, 6], [3, 30, 5], [3, 44, 3], [3, 36, 3], [3, 46, 6],
  [4, 26, 8], [4, 50, 6], [4, 44, 6], [4, 44, 4], [4, 34, 4], [4, 48, 5], [4, 46, 5], [4, 60, 8],
];
export const LEVEL_COUNT = LEVEL_META.length;
/** The level sets, by critter count. */
export const PACKS = [2, 3, 4] as const;
export type Pack = (typeof PACKS)[number];
export const packLevels = (n: number): number[] => LEVEL_META.flatMap((m, i) => (m[0] === n ? [i] : []));
export const critters = (level: number): number => LEVEL_META[level]?.[0] ?? 2;

export const GEM_POINTS = 150;
export const TIME_BONUS = 500;
export const RESTART_COST = 50;

/**
 * A cleared level's score: 1000, 150 per gem, up to 500 for time (all of it at or under par, none at
 * twice par), less 50 per restart, never under 100.
 */
export function levelScore(par: number, secs: number, gems: number, tries: number): number {
  return Math.max(100, 1000 + GEM_POINTS * gems + timeBonus(par, secs) - RESTART_COST * tries);
}

export const timeBonus = (par: number, secs: number): number => Math.round(TIME_BONUS * Math.max(0, Math.min(1, (2 * par - secs) / par)));

export const MAX_LEVEL_SCORE = 1000 + TIME_BONUS + GEM_POINTS * Math.max(...LEVEL_META.map((m) => m[2]));

/** The spoiler-free result line: time, gems, and restarts if any. */
export function resultLine(secs: number, gems: number, of: number, tries: number): string {
  return `⏱ ${Math.round(secs)}s 💎 ${gems}/${of}${tries ? ` 🔁 ${tries}` : ''}`;
}
