import { BOSSES } from '../data/bosses';
import { CLASSES, MAX_LEVEL, xpToNext } from '../data/classes';
import { REGIONS } from '../data/regions';
import { TALENTS } from '../data/talents';
import { SLOTS, type ClassId, type RegionId } from '../data/types';
import { CAMPAIGN_END } from '../data/wardens';
import { rng } from '../core/math';
import { addXp, chooseSpec, freePoints, learnTalent, newCharacter, type Character } from './character';
import { rollGear } from './items';
import type { SaveFile } from './save';

/**
 * The Rift Trials' own heroes. The Trials are played with a hero of each calling made ready for them, not with a
 * hero of the story (the owner: "similar to the vigil uses ready classes, not campaign heroes, it should save ur
 * last riftstone based on ur class so u can up it every time u log in"): the same hero for everyone who picks that
 * calling and that path, at the top level in a full set of epic gear with every talent spent, so a stone's level
 * says how well it was played and nothing about what was farmed. Nothing such a hero finds is kept; what is kept is
 * how high each calling's stone has been taken (SaveFile.rift).
 */

/** The level a story hero must have reached, on this account, before the Trials open. */
export const TRIALS_OPEN_AT = 20;

/** Whether the Trials are open to this account: some hero of its has reached TRIALS_OPEN_AT. */
export const trialsOpen = (save: Pick<SaveFile, 'heroes'>): boolean => save.heroes.some((h) => !!h && h.level >= TRIALS_OPEN_AT);

/** The stone a calling's Trials stand at on this account: the first, until it has been raised. */
export const trialStone = (save: Pick<SaveFile, 'rift'>, cls: ClassId): number => Math.max(1, Math.floor(save.rift?.[cls] ?? 1));

/** A calling's ready hero, on one of its three paths, holding the stone it has reached. */
export function trialHero(cls: ClassId, spec: 0 | 1 | 2, stone: number): Character {
  const c = newCharacter(cls, CLASSES[cls].name, `trial-${cls}`, 0);
  for (let guard = 0; c.level < MAX_LEVEL && guard < 300; guard++) addXp(c, xpToNext(c.level));
  // (the same gear for everyone: the dice are the calling's and the path's, not the day's)
  const r = rng(1009 + Object.keys(CLASSES).indexOf(cls) * 31 + spec * 7);
  for (const slot of SLOTS) c.equip[slot] = rollGear(cls, MAX_LEVEL, 'epic', r, slot);
  chooseSpec(c, spec);
  for (let guard = 0; freePoints(c) > 0 && guard < 400; guard++) {
    const node = [...TALENTS[cls]].sort((a, b) => (a.tree === spec ? 0 : 1) - (b.tree === spec ? 0 : 1) || a.row - b.row).find((n) => learnTalent(c, n.id));
    if (!node) break;
  }
  // every dungeon is theirs to enter, every boss is one they have met (no first-meeting shots against the clock),
  // and the story is behind them: a stone rises past the cap it has for a hero who hasn't finished it
  for (const id of Object.keys(REGIONS) as RegionId[]) if (!c.unlocked.includes(id)) c.unlocked.push(id);
  for (const id of Object.keys(BOSSES)) c.opened.push(`scene:boss-${id}`);
  c.quests[CAMPAIGN_END] = { state: 'done', n: 1 };
  c.tier = 2;
  c.potions = 3;
  c.keystone = Math.max(1, Math.floor(stone));
  return c;
}
