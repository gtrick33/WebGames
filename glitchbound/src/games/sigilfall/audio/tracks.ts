import type { RingSong, SongId } from './songs';

/**
 * The soundtrack: which recorded piece each land plays (the files: public/games/sigilfall/music, built by
 * scripts/sigilfall-sounds.mjs from pieces by Kevin MacLeod, incompetech.com, CC BY 4.0: credited in the game's
 * Settings and in CREDITS_AND_LICENSES.md). Lands that belong together share a piece, so a journey has a sound of its
 * own: the Vale's villages a lute, its woods something gentle, the dead lands a choir with no words, the dark woods
 * dread. A song with no piece here, or whose file can't be had, plays its procedural score (audio/songs.ts). This
 * table is the place to change by ear.
 */
export type TrackId =
  | 'title'
  | 'village'
  | 'court'
  | 'tavern'
  | 'chapel'
  | 'forest'
  | 'road'
  | 'highland'
  | 'coast'
  | 'desert'
  | 'tomb'
  | 'jungle'
  | 'forge'
  | 'barrows'
  | 'highwall'
  | 'darkwood'
  | 'snow'
  | 'rift'
  | 'crypt'
  | 'cave'
  | 'boss'
  | 'siege'
  | RingSong;

export const TRACKS: Readonly<Partial<Record<SongId, TrackId>>> = {
  title: 'title',
  boss: 'boss',
  siege: 'siege',
  // where people live
  village: 'village',
  briarhollow: 'village',
  emberwick: 'court',
  court: 'court',
  tavern: 'tavern',
  chapel: 'chapel',
  // the Vale and the first roads
  whisperwood: 'forest',
  glimmerwood: 'forest',
  brackenridge: 'road',
  thornvale: 'road',
  amberfield: 'road',
  ironpeak: 'highland',
  stormwatch: 'highland',
  saltmarsh: 'coast',
  'sunken-reaches': 'coast',
  // far lands
  sunscorch: 'desert',
  sablewind: 'desert',
  vinecoil: 'jungle',
  emberdeep: 'jungle',
  // the Hallow King's dead, and the lands they've taken
  highwall: 'highwall',
  'ashen-barrows': 'barrows',
  grimward: 'barrows',
  bonefields: 'barrows',
  hollowmere: 'barrows',
  'pale-reach': 'barrows',
  // where the light is going out
  rimeheld: 'snow',
  greyfen: 'darkwood',
  duskfen: 'darkwood',
  gloamhollow: 'darkwood',
  'weeping-woods': 'darkwood',
  blightwood: 'darkwood',
  'shattered-vale': 'darkwood',
  riftscar: 'rift',
  // (the Riftward plays the Riftscar's piece: the same tear in the world; its own score is its own song)
  riftward: 'rift',
  // under the ground
  crypt: 'crypt',
  cave: 'cave',
  deepforge: 'forge',
  'frost-vault': 'snow',
  rootdeep: 'cave',
  molten: 'forge',
  tomb: 'tomb',
  // the Ring's arenas, each its own
  'ring-sands': 'ring-sands',
  'ring-frost': 'ring-frost',
  'ring-forge': 'ring-forge',
};

/**
 * The Ring's music, by its arena's ground (the owner, 2026-11-18: "the background music should also be per map and
 * should be very cool sounding and nice"): the Proving Sands warm and dusty ("Desert City"), the Frozen Mere cool and
 * glassy ("Ice Flow"), the Cinder Forge driving and hot ("Volatile Reaction").
 */
export const RING_MUSIC: Readonly<Record<'sands' | 'frost' | 'forge', RingSong>> = { sands: 'ring-sands', frost: 'ring-frost', forge: 'ring-forge' };

/**
 * How long the end of a piece overlaps its own beginning as it comes round again, in seconds. The pieces are whole
 * compositions cut to length on a fade, not loops: a long overlap lets the end die away under the new beginning.
 */
export const SEAM: Readonly<Record<TrackId, number>> = {
  title: 3,
  village: 3,
  court: 3,
  tavern: 2,
  chapel: 3,
  forest: 3,
  road: 3,
  highland: 2,
  coast: 3,
  desert: 2,
  tomb: 3,
  jungle: 2,
  forge: 3,
  barrows: 4,
  highwall: 3,
  darkwood: 4,
  snow: 4,
  rift: 4,
  crypt: 4,
  cave: 3,
  boss: 2,
  siege: 2,
  'ring-sands': 2,
  'ring-frost': 3,
  'ring-forge': 2,
};

/** The pieces by their own titles, as the credits name them (Settings; CREDITS_AND_LICENSES.md has the rest). */
export const MUSIC_CREDITS: readonly string[] = [
  'Ascending the Vale',
  'Suonatore di Liuto',
  'Lord of the Land',
  'Minstrel Guild',
  'Agnus Dei X',
  'Enchanted Valley',
  'Teller of the Tales',
  'Skye Cuillin',
  'Moorland',
  'Ibn Al-Noor',
  'Curse of the Scarab',
  'Tabuk',
  'The Hive',
  'Ossuary 6 - Air',
  'Dark Times',
  'The Dread',
  'Frozen Star',
  'Echoes of Time v2',
  'Ossuary 5 - Rest',
  'Crypto',
  'Five Armies',
  'Heroic Age',
  'Desert City',
  'Ice Flow',
  'Volatile Reaction',
];
