import type { EnemyDef, ItemDef, NpcDef, QuestDef, RegionDef } from '../types';
import { GRIMWARD } from './grimward';
import { GRIMWARD_FOES, GRIMWARD_ITEMS } from './grimward-foes';
import { GRIMWARD_NPCS, GRIMWARD_QUESTS } from './grimward-quests';
import { SUNSCORCH } from './sunscorch';
import { SUNSCORCH_FOES, SUNSCORCH_ITEMS } from './sunscorch-foes';
import { SUNSCORCH_NPCS, SUNSCORCH_QUESTS } from './sunscorch-quests';
import { GLIMMERWOOD } from './glimmerwood';
import { GLIMMERWOOD_FOES, GLIMMERWOOD_ITEMS } from './glimmerwood-foes';
import { GLIMMERWOOD_NPCS, GLIMMERWOOD_QUESTS } from './glimmerwood-quests';
import { RIMEHELD } from './rimeheld';
import { RIMEHELD_FOES, RIMEHELD_ITEMS } from './rimeheld-foes';
import { RIMEHELD_NPCS, RIMEHELD_QUESTS } from './rimeheld-quests';
import { SHATTERED_VALE } from './shattered-vale';
import { SHATTERED_VALE_FOES, SHATTERED_VALE_ITEMS } from './shattered-vale-foes';
import { SHATTERED_VALE_NPCS, SHATTERED_VALE_QUESTS } from './shattered-vale-quests';
import { SABLEWIND } from './sablewind';
import { SABLEWIND_FOES, SABLEWIND_ITEMS } from './sablewind-foes';
import { SABLEWIND_NPCS, SABLEWIND_QUESTS } from './sablewind-quests';
import { VINECOIL } from './vinecoil';
import { VINECOIL_FOES, VINECOIL_ITEMS } from './vinecoil-foes';
import { VINECOIL_NPCS, VINECOIL_QUESTS } from './vinecoil-quests';
import { HIGHWALL } from './highwall';
import { HIGHWALL_FOES, HIGHWALL_ITEMS } from './highwall-foes';
import { HIGHWALL_NPCS, HIGHWALL_QUESTS } from './highwall-quests';
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
  { region: GRIMWARD, npcs: GRIMWARD_NPCS, quests: GRIMWARD_QUESTS, foes: GRIMWARD_FOES, items: GRIMWARD_ITEMS },
  { region: SUNSCORCH, npcs: SUNSCORCH_NPCS, quests: SUNSCORCH_QUESTS, foes: SUNSCORCH_FOES, items: SUNSCORCH_ITEMS },
  { region: GLIMMERWOOD, npcs: GLIMMERWOOD_NPCS, quests: GLIMMERWOOD_QUESTS, foes: GLIMMERWOOD_FOES, items: GLIMMERWOOD_ITEMS },
  { region: RIMEHELD, npcs: RIMEHELD_NPCS, quests: RIMEHELD_QUESTS, foes: RIMEHELD_FOES, items: RIMEHELD_ITEMS },
  { region: SHATTERED_VALE, npcs: SHATTERED_VALE_NPCS, quests: SHATTERED_VALE_QUESTS, foes: SHATTERED_VALE_FOES, items: SHATTERED_VALE_ITEMS },
  { region: SABLEWIND, npcs: SABLEWIND_NPCS, quests: SABLEWIND_QUESTS, foes: SABLEWIND_FOES, items: SABLEWIND_ITEMS },
  { region: VINECOIL, npcs: VINECOIL_NPCS, quests: VINECOIL_QUESTS, foes: VINECOIL_FOES, items: VINECOIL_ITEMS },
  { region: HIGHWALL, npcs: HIGHWALL_NPCS, quests: HIGHWALL_QUESTS, foes: HIGHWALL_FOES, items: HIGHWALL_ITEMS },
];
