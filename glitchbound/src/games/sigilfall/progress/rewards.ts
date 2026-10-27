import { ITEM_DEFS } from '../data/items';
import { outlevelled } from '../data/progression';
import { REGIONS } from '../data/regions';
import type { QuestDef } from '../data/types';
import { PERKS, type Character } from './character';

/** What a quest pays, as the quest's page and its hand-in show it (the same sums World.completeQuests pays). */
export interface RewardLine {
  kind: 'xp' | 'gold' | 'item' | 'perk' | 'unlock' | 'tier';
  text: string;
  /** An item's rarity (its color). */
  rarity?: string;
}

const RARITY_WORD: Record<string, string> = { common: 'a common', uncommon: 'an uncommon', rare: 'a rare', epic: 'an epic', legendary: 'a legendary' };

export function questRewards(c: Character, q: QuestDef): RewardLine[] {
  const r = q.reward;
  const out: RewardLine[] = [];
  const xp = Math.round(r.xp * outlevelled(c.level, q.xpLevel ?? c.level, 1));
  if (xp > 0) out.push({ kind: 'xp', text: `${xp.toLocaleString('en-US')} XP` });
  if (r.gold > 0) out.push({ kind: 'gold', text: `${r.gold.toLocaleString('en-US')} gold` });
  if (r.item === 'class-epic') out.push({ kind: 'item', text: 'An epic weapon made for your class', rarity: 'epic' });
  else if (typeof r.item === 'string') {
    const def = ITEM_DEFS[r.item];
    if (def) out.push({ kind: 'item', text: def.name, rarity: def.rarity });
  } else if (r.item) out.push({ kind: 'item', text: `${RARITY_WORD[r.item.rarity] ?? 'an'} item for your class`.replace(/^./, (s) => s.toUpperCase()), rarity: r.item.rarity });
  if (r.perk) out.push({ kind: 'perk', text: `${PERKS[r.perk].name}: ${PERKS[r.perk].text}` });
  if (r.unlock) out.push({ kind: 'unlock', text: `The way to ${REGIONS[r.unlock].name}` });
  if (r.tier) out.push({ kind: 'tier', text: r.tier >= 2 ? 'Mythic difficulty' : 'Heroic difficulty' });
  if (r.keystone) out.push({ kind: 'tier', text: `A Riftstone: Mythic +${r.keystone}` });
  return out;
}

/** One line of it, for a toast. */
export const rewardSummary = (c: Character, q: QuestDef): string => questRewards(c, q).map((l) => l.text).join(' · ');
