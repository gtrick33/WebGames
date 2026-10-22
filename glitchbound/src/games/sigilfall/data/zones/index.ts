import type { EnemyDef, ItemDef, NpcDef, QuestDef, RegionDef } from '../types';
import { BRACKENRIDGE } from './brackenridge';
import { BRACKENRIDGE_FOES, BRACKENRIDGE_ITEMS } from './brackenridge-foes';
import { BRACKENRIDGE_NPCS, BRACKENRIDGE_QUESTS } from './brackenridge-quests';
import { GREYFEN } from './greyfen';
import { GREYFEN_FOES, GREYFEN_ITEMS } from './greyfen-foes';
import { GREYFEN_NPCS, GREYFEN_QUESTS } from './greyfen-quests';
import { AMBERFIELD } from './amberfield';
import { AMBERFIELD_FOES, AMBERFIELD_ITEMS } from './amberfield-foes';
import { AMBERFIELD_NPCS, AMBERFIELD_QUESTS } from './amberfield-quests';
import { DUSKFEN } from './duskfen';
import { DUSKFEN_FOES, DUSKFEN_ITEMS } from './duskfen-foes';
import { DUSKFEN_NPCS, DUSKFEN_QUESTS } from './duskfen-quests';
import { IRONPEAK } from './ironpeak';
import { IRONPEAK_FOES, IRONPEAK_ITEMS } from './ironpeak-foes';
import { IRONPEAK_NPCS, IRONPEAK_QUESTS } from './ironpeak-quests';
import { ASHEN_BARROWS } from './ashen-barrows';
import { ASHEN_BARROWS_FOES, ASHEN_BARROWS_ITEMS } from './ashen-barrows-foes';
import { ASHEN_BARROWS_NPCS, ASHEN_BARROWS_QUESTS } from './ashen-barrows-quests';
import { STORMWATCH } from './stormwatch';
import { STORMWATCH_FOES, STORMWATCH_ITEMS } from './stormwatch-foes';
import { STORMWATCH_NPCS, STORMWATCH_QUESTS } from './stormwatch-quests';
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
  /** Hand-made items its quests and named enemies give. */
  items?: ItemDef[];
}

export const ZONES: ZoneModule[] = [
  { region: THORNVALE, npcs: THORNVALE_NPCS, quests: THORNVALE_QUESTS },
  { region: SALTMARSH, npcs: SALTMARSH_NPCS, quests: SALTMARSH_QUESTS },
  { region: BRACKENRIDGE, npcs: BRACKENRIDGE_NPCS, quests: BRACKENRIDGE_QUESTS, foes: BRACKENRIDGE_FOES, items: BRACKENRIDGE_ITEMS },
  { region: GREYFEN, npcs: GREYFEN_NPCS, quests: GREYFEN_QUESTS, foes: GREYFEN_FOES, items: GREYFEN_ITEMS },
  { region: AMBERFIELD, npcs: AMBERFIELD_NPCS, quests: AMBERFIELD_QUESTS, foes: AMBERFIELD_FOES, items: AMBERFIELD_ITEMS },
  { region: DUSKFEN, npcs: DUSKFEN_NPCS, quests: DUSKFEN_QUESTS, foes: DUSKFEN_FOES, items: DUSKFEN_ITEMS },
  { region: IRONPEAK, npcs: IRONPEAK_NPCS, quests: IRONPEAK_QUESTS, foes: IRONPEAK_FOES, items: IRONPEAK_ITEMS },
  { region: ASHEN_BARROWS, npcs: ASHEN_BARROWS_NPCS, quests: ASHEN_BARROWS_QUESTS, foes: ASHEN_BARROWS_FOES, items: ASHEN_BARROWS_ITEMS },
  { region: STORMWATCH, npcs: STORMWATCH_NPCS, quests: STORMWATCH_QUESTS, foes: STORMWATCH_FOES, items: STORMWATCH_ITEMS },
];
