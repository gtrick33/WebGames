import type { RegionId } from '../data/types';
import { trackedQuest, type Character } from './character';

/**
 * Playtest numbers (POLISH_PLAN.md piece 28): where heroes fall, and where players stop playing, counted through the
 * arcade's own first-party, cookieless analytics (src/platform/analytics.ts; docs/ANALYTICS.md). What is sent is the
 * game's own content only: the mode (the story, a Riftstone run and its stone, the Ring, the Vigil), the land, the
 * quest being followed, the hero's level, the boss if one was up, and for a stop the minutes played. No name, no hero,
 * no save: nothing that says who (the arcade leaves a member's id off these two events: functions/api/events.ts).
 *
 * A review hero (a preset, a scene preview) and a Rift Trial are test play and send nothing.
 */
/** Where the play was: the story's lands and dungeons, a Riftstone run, or a mode that draws itself. */
export type PlayMode = 'story' | 'rift' | 'ring' | 'vigil';

export interface FallProps {
  game: 'sigilfall';
  mode: PlayMode;
  /** The Riftstone's number in a run, 0 outside one. */
  key: number;
  region: string;
  quest: string;
  level: number;
  boss: string;
  [k: string]: string | number | boolean;
}

export interface StopProps {
  game: 'sigilfall';
  mode: PlayMode;
  key: number;
  region: string;
  quest: string;
  level: number;
  minutes: number;
  [k: string]: string | number | boolean;
}

/** Whether this hero's play counts: not a review hero's, nor a Trial's. */
export const counted = (h: Character | null, trial: boolean): h is Character => !!h && !h.review && !trial;

/** The props of a fall: where, on which quest, at what level, to which boss (if one was up); `key`: the Riftstone run's stone. */
export function fallProps(h: Character, region: RegionId, boss: string | null, key = 0): FallProps {
  return { game: 'sigilfall', mode: key ? 'rift' : 'story', key, region, quest: trackedQuest(h, region)?.id ?? '', level: h.level, boss: boss ?? '' };
}

/** The props of a stop: where the player left the game, on which quest, at what level, after how many minutes. */
export function stopProps(h: Character, region: RegionId | null, minutes: number, key = 0): StopProps {
  return { game: 'sigilfall', mode: key ? 'rift' : 'story', key, region: region ?? '', quest: trackedQuest(h, region ?? undefined)?.id ?? '', level: h.level, minutes: wholeMinutes(minutes) };
}

/** A stop in a mode that draws itself (the Ring, the Vigil): which, and after how many minutes in it. No hero is in it. */
export function modeStopProps(mode: 'ring' | 'vigil', minutes: number): StopProps {
  return { game: 'sigilfall', mode, key: 0, region: '', quest: '', level: 0, minutes: wholeMinutes(minutes) };
}

const wholeMinutes = (m: number): number => Math.max(0, Math.round(m));

/**
 * The line a bug report carries about where the player was (src/platform/bugContext.ts): the build, the mode, the
 * land, the quest, the level and the class. Never the hero's name, nor anything of the save.
 */
export function bugLine(build: string, h: Character | null, region: RegionId | null, key = 0, mode: PlayMode = key ? 'rift' : 'story'): string {
  const parts = [`Sigilfall build ${build || 'dev'}`];
  if (mode === 'ring' || mode === 'vigil') parts.push(mode === 'ring' ? 'the Ring' : 'the Vigil');
  else if (!h) parts.push('title screen');
  else {
    parts.push(key ? `Riftstone +${key}` : 'story', `land ${region ?? 'none'}`);
    const quest = trackedQuest(h, region ?? undefined)?.id;
    if (quest) parts.push(`quest ${quest}`);
    parts.push(`level ${h.level}`, h.cls);
  }
  return parts.join(' · ');
}
