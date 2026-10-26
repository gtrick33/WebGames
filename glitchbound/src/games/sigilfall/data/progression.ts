import type { QuestDef, RegionDef, RegionId, StoryEventDef } from './types';

/**
 * Where XP comes from (PROGRESSION_BALANCE.md Part 2, A). The level curve stays; the sources are
 * rebalanced so that a hero who plays only the main story enters every region at its floor level, and a
 * hero who does everything stays within the region's band instead of out-levelling the world:
 *
 * - the main story's quests are scaled per region (MAIN_XP, fitted by the campaign model in
 *   tests/sigilfall-progression.test.ts) so each region's chain carries the hero to the next one's floor;
 * - side quests pay SIDE_XP of what they say;
 * - quests and kills well below the hero's level pay less (outlevelled), so a completionist settles
 *   back toward the content instead of running away from it.
 */

/** The ends of the main story's chains: everything they need is the main story. */
export const MAIN_STORY_ENDS = [
  'camp-scouts',
  'camp-smiths',
  'orders-from-the-north',
  'forgemaster-grold',
  'sir-corvane',
  'festival-the-champion',
  'the-clans-decide',
  'the-vault-of-rime',
  'the-sun-king',
  'the-coiled-queen',
  'the-heart-of-the-tear',
  'fern-retaken',
  'the-long-night-ends',
  'the-third-gate',
  'the-seventh-sigil',
];

/** Side quests pay this share of their reward. */
export const SIDE_XP = 0.6;

/** The main story's quests, scaled by the region whose band they belong to (fitted; see above). */
export const MAIN_XP: Partial<Record<RegionId, number>> = {
  whisperwood: 0.3,
  brackenridge: 0.5,
  thornvale: 0.6,
  greyfen: 1,
  saltmarsh: 0.5,
  amberfield: 0.5,
  duskfen: 2,
  ironpeak: 1.85,
  'ashen-barrows': 1.1,
  grimward: 0.5,
  sunscorch: 0.4,
  glimmerwood: 0.7,
  rimeheld: 1.05,
  'shattered-vale': 0.8,
  sablewind: 1.1,
  vinecoil: 0.45,
  highwall: 1,
  gloamhollow: 0.7,
  bonefields: 0.5,
  'weeping-woods': 0.55,
  'sunken-reaches': 0.55,
  blightwood: 0.6,
  emberdeep: 0.6,
  hollowmere: 0.6,
  riftscar: 0.5,
};

/** How much less content pays for every level the hero is past it (beyond a grace), down to a fifth. */
export const OUTLEVEL_STEP = 0.2;

/** The share of XP something `contentLevel` pays a hero of `heroLevel` (quests: grace 1, kills: grace 2). */
export const outlevelled = (heroLevel: number, contentLevel: number, grace: number): number => Math.max(0.2, 1 - OUTLEVEL_STEP * Math.max(0, heroLevel - contentLevel - grace));

/** The main story: the quests the chains in MAIN_STORY_ENDS need. */
export function mainStory(defs: Record<string, QuestDef>): Set<string> {
  const main = new Set<string>();
  const walk = (id: string): void => {
    if (main.has(id) || !defs[id]) return;
    main.add(id);
    for (const a of defs[id]!.after ?? []) walk(a);
  };
  for (const id of MAIN_STORY_ENDS) walk(id);
  return main;
}

/**
 * The region whose level band a quest belongs to: where it is played if that is a wild land or a
 * dungeon, else (a town's quests) the band of the quest that leads to it.
 */
export function questBand(q: QuestDef, defs: Record<string, QuestDef>, regions: Record<string, RegionDef>, npcRegion: Record<string, RegionId>, events: Record<string, StoryEventDef>, depth = 0): RegionId {
  const o = q.objective;
  const played = o.kind === 'kill' || o.kind === 'loot' || o.kind === 'clear' ? o.region : o.kind === 'event' ? events[o.event]?.region : o.kind === 'talk' ? (npcRegion[o.npc] ?? q.zone) : (q.zone ?? npcRegion[q.giver]);
  const r = played ? regions[played] : undefined;
  if (r && r.kind !== 'town' && r.levels[0] > 1) return r.id;
  const before = q.after?.[0];
  if (before && defs[before] && depth < 16) return questBand(defs[before]!, defs, regions, npcRegion, events, depth + 1);
  return 'whisperwood';
}

/**
 * Applies the rebalance to the quest table: main-story rewards scaled by their band, side rewards by
 * SIDE_XP, and each quest's XP level (for outlevelled) set to its band's floor + 2 unless it has its own.
 */
export function balanceQuestXp(defs: Record<string, QuestDef>, regions: Record<string, RegionDef>, npcRegion: Record<string, RegionId>, events: Record<string, StoryEventDef>): void {
  const main = mainStory(defs);
  for (const q of Object.values(defs)) {
    const band = questBand(q, defs, regions, npcRegion, events);
    const k = main.has(q.id) ? (MAIN_XP[band] ?? 1) : SIDE_XP;
    q.reward = { ...q.reward, xp: Math.max(10, Math.round((q.reward.xp * k) / 5) * 5) };
    q.xpLevel ??= q.level ?? (regions[band]?.levels[0] ?? 1) + 2;
  }
}
