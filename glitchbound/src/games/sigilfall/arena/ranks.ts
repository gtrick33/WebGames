/**
 * The Ring's ranks and what this device remembers of a player's standing: on its own, away from the abilities and the
 * rest of the arena, so that the title screen can say where a hero stands without loading the whole of it.
 */

export type Format = 1 | 2 | 3;
export const FORMATS: Format[] = [1, 2, 3];

export interface Standing {
  rating: number;
  best: number;
  wins: number;
  losses: number;
  streak: number;
}

export const NEW_STANDING: Standing = { rating: 1000, best: 1000, wins: 0, losses: 0, streak: 0 };

/** Ranks: earned at the rating, kept once reached. */
export const RANKS: { at: number; name: string; color: string }[] = [
  { at: 0, name: 'Unblooded', color: '#a8a0b8' },
  { at: 1150, name: 'Blooded', color: '#c8a868' },
  { at: 1300, name: 'Sandwalker', color: '#7ad65a' },
  { at: 1500, name: 'Pit Veteran', color: '#5ab0ff' },
  { at: 1700, name: 'Bladeward', color: '#b48cff' },
  { at: 1900, name: 'Warden of the Ring', color: '#ffb45c' },
  { at: 2100, name: 'Ashbreaker', color: '#ff5a7a' },
];

export const rankOf = (rating: number): (typeof RANKS)[number] => [...RANKS].reverse().find((r) => rating >= r.at) ?? RANKS[0]!;
export const nextRank = (rating: number): (typeof RANKS)[number] | null => RANKS.find((r) => r.at > rating) ?? null;

export const RING_KEY = 'sigilfall.ring.v1';

/** A player's best standing across the formats, for showing off on the title screen. */
export function topStanding(): Standing {
  try {
    const raw = JSON.parse(localStorage.getItem(RING_KEY) ?? 'null') as { standings?: Record<string, Standing> } | null;
    const all = Object.values(raw?.standings ?? {}).filter((s) => typeof s?.rating === 'number');
    return all.reduce((a, b) => (b.rating > a.rating ? b : a), NEW_STANDING);
  } catch {
    return NEW_STANDING;
  }
}
