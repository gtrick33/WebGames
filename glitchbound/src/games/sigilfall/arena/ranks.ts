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
  /**
   * The matchmaking rating: hidden, as in rated arenas. It is what the other side is drawn against and what a match's
   * expectation is worked from; the rating shown climbs toward it (arena/ladder.ts `afterMatch`). Missing from a
   * standing kept before it existed: then it is the rating (`mmrOf`).
   */
  mmr?: number;
}

/** A standing's matchmaking rating. */
export const mmrOf = (s: Pick<Standing, 'rating' | 'mmr'>): number => (typeof s.mmr === 'number' && Number.isFinite(s.mmr) ? s.mmr : s.rating);

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

const DAY = 86_400_000;
/** The first season begins here (the day they were added), and each is eight weeks long (arena/record.ts). */
export const SEASON_START = Date.UTC(2026, 10, 16);
export const SEASON_LENGTH = 56 * DAY;
/** Which season it is. */
export const seasonOf = (now: number): number => Math.max(1, 1 + Math.floor((now - SEASON_START) / SEASON_LENGTH));
export const seasonEnds = (n: number): number => SEASON_START + n * SEASON_LENGTH;
/** A rating brought halfway back toward where everyone starts, for a new season. */
export const seasonReset = (rating: number): number => Math.round(1000 + (rating - 1000) / 2);

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

/** Each format's board on the rankings (functions/api/sigilfall/ranks.ts): `ring:<part>`, and how it is named. */
export const RING_BOARDS: readonly { format: Format; part: 'solo' | 'duo' | 'trio'; name: string }[] = [
  { format: 1, part: 'solo', name: '1v1' },
  { format: 2, part: 'duo', name: '2v2' },
  { format: 3, part: 'trio', name: '3v3' },
];

/**
 * The best rating reached in each format this device has fought in (a format with no match played is left out: its
 * 1000 is where everyone starts, not a place on its board).
 */
export function bestByFormat(): Partial<Record<Format, number>> {
  try {
    const raw = JSON.parse(localStorage.getItem(RING_KEY) ?? 'null') as { standings?: Record<string, Standing> } | null;
    const out: Partial<Record<Format, number>> = {};
    for (const f of FORMATS) {
      const s = raw?.standings?.[f];
      if (s && typeof s.best === 'number' && Number.isFinite(s.best) && (s.wins ?? 0) + (s.losses ?? 0) > 0) out[f] = s.best;
    }
    return out;
  } catch {
    return {};
  }
}

let best: number | null = null;

/** Where this device keeps its copy of a signed-in player's ranked standings, as the server last said them (net/ranked.ts). */
export const RANKED_KEY = 'sigilfall.ring.ranked';

/**
 * The best rating this device has seen the player reach, in any format: on this device's own ladder, or on the ranked
 * ladder the server keeps (kept until `forgetBest`: it is asked often). The Ring's rewards follow it.
 */
export function bestRating(): number {
  if (best === null) {
    const most = (key: string): number => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as { standings?: Record<string, Standing> } | null;
        return Object.values(raw?.standings ?? {}).reduce((a, s) => (typeof s?.best === 'number' && s.best > a ? s.best : a), NEW_STANDING.best);
      } catch {
        return NEW_STANDING.best;
      }
    };
    best = Math.max(most(RING_KEY), most(RANKED_KEY));
  }
  return best;
}

/** The standings have been written: ask them afresh. */
export function forgetBest(): void {
  best = null;
}
