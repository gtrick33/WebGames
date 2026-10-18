/**
 * Impostor rules, shared by the pass-the-phone mode (ui/Impostor.tsx) and the live rooms
 * (impostorRoom.ts). Pure: no browser APIs, so the room server can run it too.
 *
 * A round: everyone gets the secret word except the impostor(s), who get the theme and (optionally)
 * a hint. Players take turns saying one word about it, then vote someone out. A caught impostor gets
 * one guess at the word from six options to steal the round.
 */
import { IMPOSTOR_THEMES, pairs } from './content/impostor';

export type ImpostorRng = () => number;

export interface ImpostorDeal {
  theme: string;
  word: string;
  hint: string;
  /** Who the impostors are (player ids, or seat numbers as strings in rooms). */
  impostors: string[];
  /** Who says the first word. */
  starter: string;
  /** Six words from the theme (the right one among them), for a caught impostor's guess. */
  options: string[];
}

/** Every theme id, for "mix them all". */
export const ALL_THEMES = IMPOSTOR_THEMES.map((t) => t.id);

export const themeById = (id: string) => IMPOSTOR_THEMES.find((t) => t.id === id);

/** How many impostors suit a group: one, or two from seven players up when asked for. */
export const impostorCount = (players: number, wanted: 1 | 2): number => (wanted === 2 && players >= 7 ? 2 : 1);

export function impostorRng(seed: number): ImpostorRng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: readonly T[], r: ImpostorRng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Deals a round from the chosen themes, skipping words already used this session (`used` holds
 * "theme:index" ids; when a whole theme is used up it starts over).
 */
export function dealImpostor(players: readonly string[], themes: readonly string[], used: readonly string[], r: ImpostorRng, wanted: 1 | 2 = 1): { deal: ImpostorDeal; used: string[] } {
  const pool = (themes.length ? themes : ALL_THEMES).map(themeById).filter((t): t is NonNullable<typeof t> => !!t);
  const theme = pool[Math.floor(r() * pool.length)]!;
  const all = pairs(theme).map((p, i) => ({ p, id: `${theme.id}:${i}` }));
  let fresh = all.filter((x) => !used.includes(x.id));
  let nextUsed = [...used];
  if (fresh.length === 0) {
    nextUsed = used.filter((id) => !id.startsWith(`${theme.id}:`));
    fresh = all;
  }
  const pick = fresh[Math.floor(r() * fresh.length)]!;
  const [word, hint] = pick.p;
  const order = shuffled(players, r);
  const impostors = order.slice(0, impostorCount(players.length, wanted));
  const others = shuffled(
    all.filter((x) => x.p[0] !== word).map((x) => x.p[0]),
    r,
  ).slice(0, 5);
  return {
    deal: { theme: theme.id, word, hint, impostors, starter: shuffled(players, r)[0]!, options: shuffled([word, ...others], r) },
    used: [...nextUsed, pick.id],
  };
}

/** The player the group voted out: the most votes, or null on a tie (or no votes). */
export function votedOut(votes: Record<string, string>): string | null {
  const count = new Map<string, number>();
  for (const v of Object.values(votes)) count.set(v, (count.get(v) ?? 0) + 1);
  let best: string | null = null;
  let top = 0;
  let tie = false;
  for (const [who, n] of count) {
    if (n > top) {
      best = who;
      top = n;
      tie = false;
    } else if (n === top) tie = true;
  }
  return tie ? null : best;
}

export type ImpostorOutcome = 'escaped' | 'stole' | 'caught';

/**
 * How the round ended and who scores: an impostor nobody caught scores 2; a caught impostor who
 * guesses the word steals 1; otherwise everyone else scores 1.
 */
export function scoreImpostor(deal: ImpostorDeal, players: readonly string[], voted: string | null, guess: string | null): { outcome: ImpostorOutcome; points: Record<string, number> } {
  const points: Record<string, number> = {};
  const caught = voted !== null && deal.impostors.includes(voted);
  if (!caught) {
    for (const p of deal.impostors) points[p] = 2;
    return { outcome: 'escaped', points };
  }
  if (guess !== null && guess.toLowerCase() === deal.word.toLowerCase()) {
    points[voted] = 1;
    return { outcome: 'stole', points };
  }
  for (const p of players) if (!deal.impostors.includes(p)) points[p] = 1;
  return { outcome: 'caught', points };
}
