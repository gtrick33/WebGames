/**
 * One of a Kind: everyone but the guesser writes a one-word clue in secret. Clues that match each
 * other (or give the word away) cancel out before the guesser sees them. Pure helpers.
 */

/** Words count as the same when they match after this: lower case, letters only, simple endings off. */
export function stem(word: string): string {
  let w = word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ches|shes|xes|ses|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  return w;
}

/** A clue must be one word: the first word typed, trimmed, at most 24 characters. */
export const cleanClue = (raw: string): string => raw.trim().split(/\s+/)[0]?.slice(0, 24) ?? '';

export interface ClueCheck {
  clue: string;
  /** Why it was removed, or null when the guesser gets to see it. */
  out: 'twin' | 'gives-it-away' | 'empty' | null;
}

/** Marks every clue: matching ones cancel each other, ones containing the word are removed. */
export function checkClues(word: string, clues: string[]): ClueCheck[] {
  const target = stem(word);
  const stems = clues.map(stem);
  return clues.map((clue, i) => {
    const s = stems[i]!;
    if (!s) return { clue, out: 'empty' };
    if (s === target || s.includes(target) || (s.length >= 4 && target.includes(s))) return { clue, out: 'gives-it-away' };
    if (stems.some((t, j) => j !== i && t === s)) return { clue, out: 'twin' };
    return { clue, out: null };
  });
}

export const guessIsRight = (word: string, guess: string): boolean => stem(guess) === stem(word) && stem(guess) !== '';

/** Cards in a game; a wrong guess also burns the next card. */
export const DECK = 13;

export function rating(score: number): string {
  if (score >= 13) return 'Perfect! You share one brain. 🧠';
  if (score >= 11) return 'Amazing teamwork! 🌟';
  if (score >= 9) return 'Great minds! 👏';
  if (score >= 7) return 'Pretty good! 🙂';
  if (score >= 4) return 'Getting there… 🤔';
  return 'Were you even trying? 😅';
}
