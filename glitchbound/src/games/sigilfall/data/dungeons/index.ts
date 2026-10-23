import type { BossDef } from '../bosses';
import type { EnemyDef, ItemDef, RegionDef } from '../types';
import { BARROW_OF_KINGS } from './barrow-of-kings';
import { DEEPFORGE_HALLS } from './deepforge-halls';
import { ROTMOTHER_CISTERN } from './rotmother-cistern';
import { TOMB_OF_THE_SUN_KING } from './tomb-of-the-sun-king';
import { RIMEHELD_VAULT } from './rimeheld-vault';
import { SIEGE_OF_HIGHWALL } from './siege-of-highwall';
import { DUSKSPIRE } from './duskspire';
import { BLIGHTHEART } from './blightheart';
import { MOLTEN_THRONE } from './molten-throne';
import { SPIRE_OF_THE_RIFT } from './spire-of-the-rift';

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

export const DUNGEONS: DungeonModule[] = [ROTMOTHER_CISTERN, DEEPFORGE_HALLS, BARROW_OF_KINGS, TOMB_OF_THE_SUN_KING, RIMEHELD_VAULT, SIEGE_OF_HIGHWALL, BLIGHTHEART, MOLTEN_THRONE, SPIRE_OF_THE_RIFT, DUSKSPIRE];
