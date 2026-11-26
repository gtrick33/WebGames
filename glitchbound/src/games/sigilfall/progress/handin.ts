import { EVENTS } from '../data/events';
import { QUEST_DEFS } from '../data/quests';
import type { Objective, QuestDef, RegionId } from '../data/types';
import { bossRegion, npcRegion, roadsFrom, spotRegion } from '../sim/routes';

/**
 * Handing quests in (blueprint §8, "like WoW"): a quest taken from someone goes back to them when its work is
 * done, and they pay the reward and have the next request ready. That holds when the giver is where the work
 * was, or a road away from it (the crypt under the chapel, a cave off the moor); one done far from its giver
 * (a letter from the capital) pays out where it ends. A talk quest is handed in by the talk itself, and the
 * story's own beats (`auto`: a raid running into the next) flow on by themselves unless they name someone.
 */

/** A quest's steps, in order: its objective, then its further steps. */
export const questSteps = (q: QuestDef): Objective[] => [q.objective, ...(q.then ?? [])];

/** Where an objective is done. */
export function objectiveRegion(q: QuestDef, o: Objective): RegionId | undefined {
  switch (o.kind) {
    case 'kill':
    case 'loot':
    case 'clear':
    case 'use':
    case 'carry':
    case 'hold':
    case 'trail':
    case 'subdue':
      return o.region;
    case 'boss':
      return bossRegion(o.boss) ?? q.zone;
    case 'explore':
      return spotRegion(o.spot) ?? q.zone;
    case 'event':
      return EVENTS[o.event]?.region ?? q.zone;
    case 'talk':
      return npcRegion(o.npc) ?? q.zone;
    case 'tutorial':
      return 'briarhollow';
    case 'collect':
      return 'whisperwood';
  }
}

const memo = new Map<string, string | null>();

/** Who a quest is handed in to, or null when it pays out the moment its work is done. */
export function turnInNpc(q: QuestDef): string | null {
  const hit = memo.get(q.id);
  if (hit !== undefined) return hit;
  let who: string | null = null;
  const steps = questSteps(q);
  const last = steps[steps.length - 1]!;
  if (q.turnIn) who = q.turnIn;
  else if (q.turnIn !== false && !q.auto && last.kind !== 'talk') {
    const home = npcRegion(q.giver);
    const where = objectiveRegion(q, last);
    if (home && where && (home === where || roadsFrom(home).includes(where))) who = q.giver;
  }
  memo.set(q.id, who);
  return who;
}

/** Whether a quest belongs to the main story: one the last bell can't ring without. */
let main: Set<string> | null = null;
export function isMainQuest(id: string): boolean {
  if (!main) {
    main = new Set<string>();
    const walk = (q: string): void => {
      if (main!.has(q)) return;
      main!.add(q);
      for (const a of QUEST_DEFS[q]?.after ?? []) walk(a);
    };
    walk('epilogue-the-bell');
  }
  return main.has(id);
}
