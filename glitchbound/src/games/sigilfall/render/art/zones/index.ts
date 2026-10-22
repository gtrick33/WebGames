import type { Art } from '../../artdata';
import type { HeroLook } from '../hero';
import { BRACKENRIDGE_ART } from './brackenridge';
import { GREYFEN_ART } from './greyfen';
import { AMBERFIELD_ART } from './amberfield';
import { DUSKFEN_ART } from './duskfen';
import { IRONPEAK_ART } from './ironpeak';
import { ASHEN_BARROWS_ART } from './ashen-barrows';
import { STORMWATCH_ART } from './stormwatch';
import { ROTMOTHER_CISTERN_ART } from './rotmother-cistern';
import { DEEPFORGE_HALLS_ART } from './deepforge-halls';
import { BARROW_OF_KINGS_ART } from './barrow-of-kings';
import { GRIMWARD_ART } from './grimward';
import { SUNSCORCH_ART } from './sunscorch';
import { GLIMMERWOOD_ART } from './glimmerwood';
import { RIMEHELD_ART } from './rimeheld';
import { SHATTERED_VALE_ART } from './shattered-vale';
import { SABLEWIND_ART } from './sablewind';
import { VINECOIL_ART } from './vinecoil';
import { HIGHWALL_ART } from './highwall';
import { TOMB_OF_THE_SUN_KING_ART } from './tomb-of-the-sun-king';
import { RIMEHELD_VAULT_ART } from './rimeheld-vault';
import { SIEGE_OF_HIGHWALL_ART } from './siege-of-highwall';

/**
 * Each zone's art: its enemies (text art, like the creatures) and how its townsfolk dress. Adding a
 * zone's art is a file in this folder and a line here.
 */
export interface ZoneArt {
  foes: Record<string, Art>;
  looks: Record<string, HeroLook>;
}

export const ZONE_ART: ZoneArt[] = [BRACKENRIDGE_ART, GREYFEN_ART, AMBERFIELD_ART, DUSKFEN_ART, IRONPEAK_ART, ASHEN_BARROWS_ART, STORMWATCH_ART, ROTMOTHER_CISTERN_ART, DEEPFORGE_HALLS_ART, BARROW_OF_KINGS_ART, GRIMWARD_ART, SUNSCORCH_ART, GLIMMERWOOD_ART, RIMEHELD_ART, SHATTERED_VALE_ART, SABLEWIND_ART, VINECOIL_ART, HIGHWALL_ART, TOMB_OF_THE_SUN_KING_ART, RIMEHELD_VAULT_ART, SIEGE_OF_HIGHWALL_ART];
