import type { MusicTrack } from '../data/types';
import type { AmbienceId } from './samples';

/**
 * The air of each land, under its music: birds over the villages and the fields, a wood's own hush, wind on the
 * heights, the sands and the dead lands, water in the marshes and by the sea, and the drip of stone underground.
 * Lands are known here by their song (data/types.ts MusicTrack: every land has its own, and the insides of buildings
 * share a few). Indoors, and in a battle for a town, there is none.
 */
const AIR: Readonly<Partial<Record<MusicTrack, AmbienceId>>> = {
  // where people live, and the fields round them
  emberwick: 'day',
  briarhollow: 'day',
  village: 'day',
  amberfield: 'day',
  brackenridge: 'day',
  thornvale: 'day',
  // the woods
  whisperwood: 'forest',
  glimmerwood: 'forest',
  vinecoil: 'forest',
  // marsh, mere and shore
  saltmarsh: 'water',
  'sunken-reaches': 'water',
  greyfen: 'water',
  duskfen: 'water',
  hollowmere: 'water',
  // the heights, the sands, and the lands the dead have taken
  ironpeak: 'wind',
  stormwatch: 'wind',
  rimeheld: 'wind',
  sunscorch: 'wind',
  sablewind: 'wind',
  highwall: 'wind',
  'ashen-barrows': 'wind',
  grimward: 'wind',
  bonefields: 'wind',
  'pale-reach': 'wind',
  'shattered-vale': 'wind',
  riftscar: 'wind',
  gloamhollow: 'wind',
  'weeping-woods': 'wind',
  blightwood: 'wind',
  emberdeep: 'wind',
  // under the ground
  crypt: 'cave',
  cave: 'cave',
  'frost-vault': 'cave',
  molten: 'cave',
  rootdeep: 'cave',
  tomb: 'cave',
  deepforge: 'cave',
};

/** The air of the land whose song this is (null: none). */
export const ambienceOf = (music: MusicTrack): AmbienceId | null => AIR[music] ?? null;
