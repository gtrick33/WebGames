import { GAMES } from '../catalog/games';

/**
 * Which of this device's saves follow a signed-in player to the server (platform/cloudSave.ts,
 * functions/api/saves.ts): the arcade save and each game's own save. Settings-only keys
 * ("glitchbound.crass-act.adult"), Mini Racer ghosts and everything else stay on the device.
 */

/** The arcade's save: rounds, bests, the Daily Challenge and which games' dailies are done. */
export const ARCADE_SAVE_KEY = 'glitchbound.save';

/** Biggest save that is synced (characters of JSON); a bigger one stays on its device. */
export const MAX_SYNCED_SAVE = 96_000;

const SLUGS = new Set(GAMES.map((g) => g.slug));
/** Saves of games that don't use the arcade's naming (embeds built on their own). */
const OWN_KEYS: Record<string, string> = { 'neonrush.save': 'neon-rush', 'sigilfall.ring.v1': 'sigilfall', 'sigilfall.vigil.bests': 'sigilfall' };
const GAME_KEY = /^(?:glitchbound|gb)\.([a-z0-9-]{1,40})(?:\.v\d{1,2})?$/;

/** The game a save belongs to ("glitchbound.fussbox", "gb.mini-racer.v1", "neonrush.save"), or null (the arcade save, other keys). */
export function slugOfKey(key: string): string | null {
  const slug = Object.hasOwn(OWN_KEYS, key) ? OWN_KEYS[key] : GAME_KEY.exec(key)?.[1];
  return slug && SLUGS.has(slug) ? slug : null;
}

export const isSyncedKey = (key: string): boolean => key === ARCADE_SAVE_KEY || slugOfKey(key) !== null;
