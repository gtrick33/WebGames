/**
 * Dial It In: a hidden target sits somewhere on a scale between two opposites. The reader sees it and
 * gives a clue out loud; everyone else turns the needle to where they think it is. Pure helpers.
 */

/** Bullseye zones, from the target outwards (in dial units, 0 to 100). */
export const ZONES: { within: number; points: number }[] = [
  { within: 3.5, points: 4 },
  { within: 9, points: 3 },
  { within: 15, points: 2 },
];

export function dialPoints(target: number, guess: number): number {
  const d = Math.abs(target - guess);
  return ZONES.find((z) => d <= z.within)?.points ?? 0;
}

/** A target that keeps its whole scoring zone on the dial. */
export const randomTarget = (r: () => number): number => Math.round(8 + r() * 84);

/** In team games the other side calls "left" or "right" of the guess for a steal point. */
export function stealRight(target: number, guess: number, call: 'left' | 'right'): boolean {
  if (dialPoints(target, guess) === 4) return false;
  return call === 'left' ? target < guess : target > guess;
}

/** Splits players into two teams, alternating, so seats around the table mix. */
export function splitTeams<T>(players: readonly T[]): [T[], T[]] {
  return [players.filter((_, i) => i % 2 === 0), players.filter((_, i) => i % 2 === 1)];
}

/** How a round reads after the reveal. */
export function dialVerdict(points: number): string {
  return points === 4 ? 'Bullseye! 🎯' : points === 3 ? 'So close! 🔥' : points === 2 ? 'In the zone 👍' : 'Way off 🙈';
}
