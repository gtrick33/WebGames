import type { SongId } from './songs';

/**
 * The soundtrack: which recorded piece each land plays (the files: public/games/sigilfall/music, built by
 * scripts/sigilfall-sounds.mjs from the Orchestral and World Music Pack by Ragnar Random, CC0). Lands that belong
 * together share a piece, so a journey has a sound of its own. A song with no piece here, or whose file can't be had,
 * plays its procedural score (audio/songs.ts). This table is the place to change by ear.
 */
export type TrackId = 'adventure' | 'town' | 'road' | 'elf' | 'tower' | 'battle' | 'dark-elf' | 'sultan' | 'sultan-slow' | 'tribe' | 'shaman' | 'qetzyl';

export const TRACKS: Readonly<Partial<Record<SongId, TrackId>>> = {
  title: 'adventure',
  boss: 'battle',
  siege: 'battle',
  // where people live
  village: 'town',
  briarhollow: 'town',
  emberwick: 'town',
  court: 'town',
  tavern: 'tribe',
  chapel: 'tower',
  // the Vale and the first roads
  whisperwood: 'elf',
  glimmerwood: 'elf',
  brackenridge: 'adventure',
  thornvale: 'adventure',
  amberfield: 'road',
  ironpeak: 'road',
  stormwatch: 'road',
  saltmarsh: 'tribe',
  'sunken-reaches': 'tribe',
  // far lands
  sunscorch: 'sultan-slow',
  sablewind: 'sultan',
  vinecoil: 'shaman',
  emberdeep: 'shaman',
  // the Hallow King's dead, and the lands they've taken
  highwall: 'tower',
  'ashen-barrows': 'tower',
  grimward: 'tower',
  bonefields: 'tower',
  hollowmere: 'tower',
  'pale-reach': 'tower',
  // where the light is going out
  rimeheld: 'dark-elf',
  greyfen: 'dark-elf',
  duskfen: 'dark-elf',
  gloamhollow: 'dark-elf',
  'weeping-woods': 'dark-elf',
  blightwood: 'dark-elf',
  'shattered-vale': 'dark-elf',
  riftscar: 'qetzyl',
  // under the ground
  crypt: 'tower',
  cave: 'qetzyl',
  deepforge: 'qetzyl',
  'frost-vault': 'qetzyl',
  rootdeep: 'dark-elf',
  molten: 'shaman',
  tomb: 'sultan-slow',
};

/** How long the end of a piece overlaps its own beginning as it comes round again, in seconds. */
export const SEAM: Readonly<Record<TrackId, number>> = {
  adventure: 0.4,
  town: 1.5,
  road: 0.4,
  elf: 0.4,
  tower: 0.4,
  battle: 0.4,
  'dark-elf': 0.4,
  sultan: 0.4,
  'sultan-slow': 0.4,
  tribe: 0.4,
  shaman: 2,
  qetzyl: 2,
};
