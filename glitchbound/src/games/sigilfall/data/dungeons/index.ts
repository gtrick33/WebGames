import type { BossDef } from '../bosses';
import type { EnemyDef, ItemDef, RegionDef } from '../types';
import { BARROW_OF_KINGS } from './barrow-of-kings';
import { DEEPFORGE_HALLS } from './deepforge-halls';
import { ROTMOTHER_CISTERN } from './rotmother-cistern';

/**
 * Dungeons with everything that is theirs: the rooms (a hand-laid map), the bosses, the enemies first
 * met there and the items only they give. Their boss attacks beyond boss.ts's own are in
 * sim/patterns/. Adding one is a file here and a line below. (Gallows Keep and the Smugglers' Grotto
 * came first and keep their bosses in bosses.ts.)
 */
export interface DungeonModule {
  region: RegionDef;
  bosses: Record<string, BossDef>;
  foes?: Record<string, EnemyDef>;
  items?: ItemDef[];
}

export const DUNGEONS: DungeonModule[] = [ROTMOTHER_CISTERN, DEEPFORGE_HALLS, BARROW_OF_KINGS];
