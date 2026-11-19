import type { RegionId } from '../data/types';
import { trackedQuest, type Character } from './character';

/**
 * Playtest numbers (POLISH_PLAN.md piece 28): where heroes fall, and where players stop playing, counted through the
 * arcade's own first-party, cookieless analytics (src/platform/analytics.ts; docs/ANALYTICS.md). What is sent is the
 * game's own content only: the land, the quest being followed, the hero's level, the boss if one was up, and for a
 * stop the minutes played. No name, no hero, no save: nothing that says who.
 *
 * A review hero (a preset, a scene preview) and a Rift Trial are test play and send nothing.
 */
export interface FallProps {
  game: 'sigilfall';
  region: string;
  quest: string;
  level: number;
  boss: string;
  [k: string]: string | number | boolean;
}

export interface StopProps {
  game: 'sigilfall';
  region: string;
  quest: string;
  level: number;
  minutes: number;
  [k: string]: string | number | boolean;
}

/** Whether this hero's play counts: not a review hero's, nor a Trial's. */
export const counted = (h: Character | null, trial: boolean): h is Character => !!h && !h.review && !trial;

/** The props of a fall: where, on which quest, at what level, to which boss (if one was up). */
export function fallProps(h: Character, region: RegionId, boss: string | null): FallProps {
  return { game: 'sigilfall', region, quest: trackedQuest(h, region)?.id ?? '', level: h.level, boss: boss ?? '' };
}

/** The props of a stop: where the player left the game, on which quest, at what level, after how many minutes. */
export function stopProps(h: Character, region: RegionId | null, minutes: number): StopProps {
  return { game: 'sigilfall', region: region ?? '', quest: trackedQuest(h, region ?? undefined)?.id ?? '', level: h.level, minutes: Math.max(0, Math.round(minutes)) };
}
