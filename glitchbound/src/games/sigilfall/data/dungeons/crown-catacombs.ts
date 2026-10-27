import type { DungeonModule } from '.';
import type { BossDef } from '../bosses';
import type { Marker } from '../types';

/*
 * The Crown City's catacombs (level 60, postgame): one of the threads the story left open (STORY_BIBLE.md §3,
 * Epilogue). Lord Chancellor Maelis Crane ran down his cellar stair on the Night of Knives and barred the door
 * behind him. Under the old city he found what he had always wanted: a hoard of ash-gold nobody could count,
 * and the last of the Herald's agents to spend it for him. The ossuary of ash-gold first, then Crane in the
 * old kings' vault, with the cold coin grown into him.
 */
const MAP = [
  '##################################################',
  '##################################################',
  '##############bbbbbbbbbbbbbbbbbbbbbb##############',
  '##############bbbbbbbbbbbbbbbbbbbbbb##############',
  '##############bbQbbbbbbbbbbbbbbbbQbb##############',
  '##############bbbbbbbbbbVbbbbbbbbbbb##############',
  '##############bbbbbbbbbbbbbbbbbbbbbb##############',
  '##############bbbbbjbbbbbbbbbbjbbbbb##############',
  '##############bbbbbbbbbbbbbbbbbbbbbb##############',
  '##############bbbbbjbbbbbbbbbbjbbbbb##############',
  '##############bbbbbbbbbbbbbbbbbbbbbb##############',
  '##############bbQbbbbbbbbbbbbbbbbQbb##############',
  '##############bbbbbbbbbbbbbbbbbbbbbb##############',
  '##############bbbbbbbbbbbbbbbbbbbbbb##############',
  '#######################DDDD#######################',
  '#######################....#######################',
  '#######################DDDD#######################',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaanaaaaaaaaaaaaaaaaaaaaaanaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaajaaaaaaaaaaaajaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaanaaaaaaaaaaaaaaaaaaaaaanaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '#######################DDDD#######################',
  '#######################....#######################',
  '#######################..P.#######################',
  '#######################....#######################',
  '##########################X#######################',
  '##################################################',
];

const markers: Record<string, Marker> = {
  P: { kind: 'start' },
  X: { kind: 'exit', to: 'emberwick', label: 'Up the stair to the Crown City' },
  V: { kind: 'boss', boss: 'maelis-crane' },
  n: { kind: 'prop', prop: 'bones' },
};

const MAELIS_CRANE: BossDef = {
  id: 'maelis-crane',
  name: 'Maelis Crane',
  title: 'Lord Chancellor of Aster, once',
  sprite: 'maelis-crane',
  hp: 9000,
  dmg: 30,
  radius: 11,
  xp: 6000,
  gold: [3000, 4000],
  phases: [
    {
      // the patient counsellor: he throws money at you, which is what he always did
      at: 1,
      speed: 38,
      rest: [0.7, 1.1],
      patterns: [
        { id: 'volley', w: 3, cd: 4, p: { shots: 3 } },
        { id: 'orbs', w: 2, cd: 6, p: { count: 6, speed: 70, homing: 0.7, mul: 0.8, color: '#c8c4a8' } },
        { id: 'summon', w: 1, cd: 16, p: { enemies: ['hired-knife', 'hired-knife'] } },
        { id: 'teleport', w: 1, cd: 9 },
      ],
    },
    {
      at: 0.5,
      banner: 'The ash-gold grows into him: it weighs nothing, and it is always cold',
      speed: 44,
      rest: [0.5, 0.9],
      enter: [{ id: 'roar', w: 1, cd: 0 }],
      patterns: [
        { id: 'riftSpiral', w: 2, cd: 8, p: { arms: 3, time: 2.4 } },
        { id: 'graveGrasp', w: 2, cd: 6, p: { count: 4 } },
        { id: 'orbs', w: 3, cd: 4.5, p: { count: 8, speed: 78, homing: 1, mul: 0.8, color: '#c8c4a8' } },
        { id: 'summon', w: 1, cd: 18, p: { enemies: ['ashen-assassin', 'hired-knife'] } },
        { id: 'teleport', w: 1, cd: 8 },
      ],
    },
  ],
  first: { any: ['vaelors-heartstone'] },
  drops: { items: { any: ['shroud-of-duskspire', 'hollowbrand-shard'] }, chance: [0.3, 0.5, 0.8] },
  intro: 'The Regent’s oldest counsellor, in his good black coat, with grey coin grown over his hands like scales. He seems glad to see you. He was always glad to see people.',
};

export const CROWN_CATACOMBS: DungeonModule = {
  region: {
    id: 'crown-catacombs',
    name: 'The Catacombs',
    subtitle: 'Under the Crown City',
    theme: 'crypt',
    kind: 'dungeon',
    level: 60,
    levels: [60, 60],
    at: [35, 71],
    dark: true,
    safe: false,
    music: 'crypt',
    map: MAP,
    markers,
    encounters: [
      {
        id: 'ossuary',
        floor: 'a',
        title: 'The Ossuary of Ash-Gold',
        waves: [
          { enemies: ['hired-knife', 'hired-knife', 'ashen-assassin', 'kneeling-dead'] },
          { enemies: ['ashen-assassin', 'ashen-assassin', 'wailing-soul', 'kneeling-dead', 'kneeling-dead'] },
          { enemies: ['hired-knife', 'hired-knife', 'ashen-assassin', 'wailing-soul'], elite: true },
        ],
      },
      { id: 'vault', floor: 'b', waves: [], boss: 'maelis-crane', checkpoint: true, title: 'The Old Kings’ Vault' },
    ],
    blurb: 'Under the Crown City, where the Lord Chancellor ran on the Night of Knives and never came up.',
  },
  bosses: { 'maelis-crane': MAELIS_CRANE },
};
