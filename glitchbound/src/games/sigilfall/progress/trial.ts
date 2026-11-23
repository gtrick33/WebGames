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

/**
 * The deepest stone a calling has opened on this account, in any dungeon, by its champion or by a hero of its own:
 * how many dungeons its stone reaches (data/keystones.ts riftDungeons), and what the lobby shows beside it.
 */
export function trialStone(save: Pick<SaveFile, 'rift'> & Partial<Pick<SaveFile, 'riftBy' | 'heroes'>>, cls: ClassId): number {
  let n = save.rift?.[cls] ?? 1;
  for (const v of Object.values(save.riftBy?.[cls] ?? {})) n = Math.max(n, v);
  for (const h of save.heroes ?? []) if (h && h.cls === cls) n = Math.max(n, h.keystone);
  return Math.max(1, Math.floor(n));
}

/**
 * The stone a calling may take into one dungeon on this account: the deepest opened there, by its champion in the
 * Riftstone tab or by any hero of the calling in the campaign (the owner, 2026-11-22: "if i reach rank 9 at the first
 * dungeon, i shouldnt be able to start rank 9 on the second one", and a stone opened in the Riftstone tab was not
 * open to the campaign hero). `own` is the hero playing now, whose stones may be newer than the save's.
 */
export function stoneIn(save: Partial<Pick<SaveFile, 'riftBy' | 'heroes'>>, cls: ClassId, region: string, own?: Pick<Character, 'stones'> | null): number {
  let n = save.riftBy?.[cls]?.[region] ?? 0;
  for (const h of save.heroes ?? []) if (h && h.cls === cls) n = Math.max(n, h.stones?.[region] ?? 0);
  if (own) n = Math.max(n, own.stones?.[region] ?? 0);
  return Math.max(1, Math.floor(n));
}

/** A calling's stones, dungeon by dungeon, as the account has them (for its champion to carry into a run). */
export function stonesOf(save: Partial<Pick<SaveFile, 'riftBy' | 'heroes'>>, cls: ClassId): Record<string, number> {
  const out: Record<string, number> = { ...(save.riftBy?.[cls] ?? {}) };
  for (const h of save.heroes ?? []) if (h && h.cls === cls) for (const [r, n] of Object.entries(h.stones ?? {})) out[r] = Math.max(out[r] ?? 0, n);
  return out;
}

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
  c.stones = {};
  return c;
}
