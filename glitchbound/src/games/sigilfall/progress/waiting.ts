import { NPCS } from '../data/quests';
import { REGIONS } from '../data/regions';
import type { QuestDef, RegionId } from '../data/types';
import { npcRegion } from '../sim/routes';
import { isReplay, levelGated, questRegion, questState, type Character } from './character';
import { isMainQuest } from './handin';
import { QUESTS } from '../data/quests';

/**
 * What the tracker says to do for the story's next quest while it waits to be taken (progress/character.ts storyOffer):
 * see whoever gives it, and in which land when it isn't this one.
 */
export function offerStep(c: Character, q: QuestDef, here?: RegionId): string {
  const who = NPCS[q.giver]?.name ?? 'whoever gives it';
  const where = npcRegion(q.giver, c) ?? npcRegion(q.giver);
  const land = where && where !== here ? REGIONS[where]?.name : undefined;
  return land ? `Talk to ${who} in ${land}` : `Talk to ${who}`;
}

/** What the tracker suggests while the main story waits for a level: a side quest, and where to go for it. */
export interface Meanwhile {
  q: QuestDef;
  /** Already taken (else it waits with its giver). */
  taken: boolean;
  /** Its giver, for one not taken yet. */
  giver?: string;
  /** The land it is done in (taken) or given in (not yet). */
  where?: RegionId;
  /** That land's name. */
  land?: string;
}

/**
 * The story's next step waits for a level: a side quest to do meanwhile, so the tracker never just says "opens at level
 * 21" (it pointed at clearing the first crypt again on Heroic). One already taken comes first, then one waiting with
 * its giver in a land the hero can reach; nearer the hero's level first, and here before elsewhere. A replay on a
 * harder tier is never the suggestion. Null when the story isn't waiting, or there is nothing.
 */
export function meanwhile(c: Character, here?: RegionId): Meanwhile | null {
  if (QUESTS.some((q) => isMainQuest(q.id) && (questState(c, q.id) === 'active' || questState(c, q.id) === 'ready'))) return null;
  if (!levelGated(c).some((q) => isMainQuest(q.id))) return null;
  const near = (q: QuestDef): number => Math.abs((q.xpLevel ?? q.level ?? c.level) - c.level);
  const open = (r: RegionId | undefined): boolean => !!r && (REGIONS[r]?.kind === 'town' || c.unlocked.includes(r));
  const rank = (a: { q: QuestDef; where?: RegionId }, b: { q: QuestDef; where?: RegionId }): number => Number(b.where === here) - Number(a.where === here) || near(a.q) - near(b.q);
  const taken = QUESTS.filter((q) => !isMainQuest(q.id) && !isReplay(q) && (questState(c, q.id) === 'active' || questState(c, q.id) === 'ready'))
    .map((q) => ({ q, where: questRegion(q) }))
    .sort(rank)[0];
  if (taken) return { q: taken.q, taken: true, where: taken.where, land: taken.where ? REGIONS[taken.where]?.name : undefined };
  const offered = QUESTS.filter((q) => !isMainQuest(q.id) && !isReplay(q) && questState(c, q.id) === 'offered')
    .map((q) => ({ q, where: npcRegion(q.giver, c) ?? npcRegion(q.giver) }))
    .filter((x) => open(x.where) && NPCS[x.q.giver])
    .sort(rank)[0];
  if (offered) return { q: offered.q, taken: false, giver: NPCS[offered.q.giver]!.name, where: offered.where, land: offered.where ? REGIONS[offered.where]?.name : undefined };
  return null;
}
