import type { EnemyDef, NpcDef, QuestDef, RegionDef } from '../types';
import { SALTMARSH } from './saltmarsh';
import { SALTMARSH_NPCS, SALTMARSH_QUESTS } from './saltmarsh-quests';
import { THORNVALE } from './thornvale';
import { THORNVALE_NPCS, THORNVALE_QUESTS } from './thornvale-quests';

/**
 * Every generated zone with its people, quests and enemies (see WORLD.md for the whole world). Adding
 * a zone is its files here (the spec; its quests and townsfolk; its enemies), its art in
 * render/art/zones/, and a line in each index.
 */
export interface ZoneModule {
  region: RegionDef;
  npcs: Record<string, NpcDef>;
  quests: QuestDef[];
  /** Enemies first met in this zone (others reuse them by id). */
  foes?: Record<string, EnemyDef>;
}

export const ZONES: ZoneModule[] = [
  { region: THORNVALE, npcs: THORNVALE_NPCS, quests: THORNVALE_QUESTS },
  { region: SALTMARSH, npcs: SALTMARSH_NPCS, quests: SALTMARSH_QUESTS },
];
