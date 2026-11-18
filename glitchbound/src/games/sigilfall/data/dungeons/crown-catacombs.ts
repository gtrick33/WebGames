import type { DungeonModule } from '.';
import type { BossDef } from '../bosses';
import type { Marker } from '../types';

/*
 * The Crown City's catacombs (level 60, postgame): one of the threads the story left open (STORY_BIBLE.md §3,
 * Epilogue). Lord Chancellor Maelis Crane ran down his cellar stair on the Night of Knives and barred the door
 * behind him. Under the old city he found what he had always wanted: a hoard of ash-gold nobody could count,
 * and the last of the Herald's agents to spend it for him. The ossuary of ash-gold first, where that agent, Silas
 * Vey, keeps the purse; then the old kings' Counting Hall, where their Royal Auditor still keeps the books; then
 * Crane in the old kings' vault, with the cold coin grown into him.
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
  '############cccccccccccccccccccccccccc############',
  '############cccccccccccccccccccccccccc############',
  '############ccQcccccccccccccccccccQccc############',
  '############cccccccccccccccccccccccccc############',
  '############ccccccjcccccccccccjccccccc############',
  '############ccccccccccccWccccccccccccc############',
  '############ccccccjcccccccccccjccccccc############',
  '############cccccccccccccccccccccccccc############',
  '############ccQcccccccccccccccccccQccc############',
  '############cccccccccccccccccccccccccc############',
  '#######################DDDD#######################',
  '#######################....#######################',
  '#######################DDDD#######################',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaanaaaaaaaaaaaaaaaaaaaaaanaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaajaaaaaOaaaaaajaaaaaaaa##########',
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
  // the Ossuary of Ash-Gold: Silas Vey and his purse; the Counting Hall: the Royal Auditor (sim/patterns/crown-catacombs.ts)
  O: { kind: 'boss', boss: 'silas-vey' },
  W: { kind: 'boss', boss: 'the-royal-auditor' },
  n: { kind: 'prop', prop: 'bones' },
};

const SILAS_VEY: BossDef = {
  id: 'silas-vey',
  name: 'Silas Vey',
  title: 'The Herald’s Last Hand',
  sprite: 'silas-vey',
  hp: 6400,
  dmg: 28,
  radius: 10,
  xp: 2200,
  gold: [500, 800],
  phases: [
    {
      at: 1,
      speed: 52,
      rest: [0.6, 0.95],
      // the Chancellor's ash-gold thrown about the ossuary as the hero comes in
      enter: [{ id: 'crown:scatter', w: 1, cd: 14, p: { coins: 10, spend: 7, per: 3 } }],
      patterns: [
        // knives thrown on wires, and pulled back to his hand
        { id: 'spell:boomerang', w: 3, cd: 4.5, p: { look: 'spear', color: '#d8d4e0', type: 'physical', count: 3, spread: 0.7, speed: 160, out: 0.65, mul: 0.8 } },
        { id: 'cleave', w: 2, cd: 3.5, p: { r: 44, arc: 1.1, wind: 0.6, lunge: 30, mul: 1.3 } },
        { id: 'crown:scatter', w: 3, cd: 14, p: { coins: 10, spend: 7, per: 3 } },
      ],
    },
    {
      at: 0.5,
      banner: 'Silas throws ash-gold across the floor! Pick up the coins, or he hires a blade with them.',
      speed: 58,
      rest: [0.45, 0.8],
      enter: [{ id: 'crown:scatter', w: 1, cd: 12, p: { coins: 14, spend: 6.5, per: 3 } }],
      patterns: [
        { id: 'spell:boomerang', w: 3, cd: 4, p: { look: 'spear', color: '#d8d4e0', type: 'physical', count: 5, spread: 1, speed: 165, out: 0.65, mul: 0.8 } },
        { id: 'cleave', w: 2, cd: 3, p: { swings: 2, r: 44, arc: 1.1, wind: 0.5, gap: 0.12, lunge: 30, mul: 1.25 } },
        { id: 'crown:scatter', w: 3, cd: 12, p: { coins: 14, spend: 6.5, per: 3 } },
      ],
    },
  ],
  first: { any: ['glitch-shard'] },
  drops: { items: { any: ['glitch-shard', 'amulet-of-echoes', 'shroud-of-duskspire'] }, chance: [0.3, 0.5, 0.75] },
  intro: 'The Pale Herald’s spymaster in Aster for twenty years. He paid Crane, and every other traitor in the city, in the Herald’s ash-gold.',
};

const ROYAL_AUDITOR: BossDef = {
  id: 'the-royal-auditor',
  name: 'The Royal Auditor',
  title: 'Keeper of the Old Kings’ Accounts',
  sprite: 'the-royal-auditor',
  hp: 7800,
  dmg: 30,
  radius: 11,
  xp: 2600,
  gold: [600, 900],
  phases: [
    {
      at: 1,
      speed: 36,
      rest: [0.7, 1.05],
      // his book opened as the hero comes in: every blow from then on is written down
      enter: [{ id: 'crown:ledger', w: 1, cd: 0 }],
      patterns: [
        // quills of red ink hung in the air round the hero, then all flying at once
        { id: 'spell:quills', w: 3, cd: 5, p: { color: '#f0e0a0', type: 'holy', count: 8, spread: 95, hang: 1.1, speed: 170, mul: 0.8 } },
        { id: 'cleave', w: 2, cd: 3.5, p: { r: 48, arc: 1, wind: 0.75, lunge: 16, mul: 1.3 } },
        // every blow written down, and then the reckoning
        { id: 'crown:settle', w: 3, cd: 12, p: { warn: 2.6, share: 0.35, cap: 0.4, rr: 36 } },
      ],
    },
    {
      at: 0.5,
      banner: 'The Auditor settles his accounts faster now! Stand inside the ward when he does.',
      speed: 40,
      rest: [0.5, 0.85],
      enter: [{ id: 'crown:settle', w: 1, cd: 10, p: { warn: 2.2, share: 0.45, cap: 0.45, rr: 32 } }],
      patterns: [
        // quills of red ink hung in the air round the hero, then all flying at once
        { id: 'spell:quills', w: 3, cd: 4.5, p: { color: '#f0e0a0', type: 'holy', count: 8, spread: 95, hang: 1.1, speed: 170, mul: 0.8 } },
        { id: 'cleave', w: 2, cd: 3, p: { swings: 2, r: 48, arc: 1, wind: 0.6, gap: 0.14, lunge: 18, mul: 1.25 } },
        { id: 'crown:settle', w: 3, cd: 10, p: { warn: 2.2, share: 0.45, cap: 0.45, rr: 32 } },
      ],
    },
  ],
  first: { any: ['amulet-of-echoes'] },
  drops: { items: { any: ['amulet-of-echoes', 'glitch-shard', 'shroud-of-duskspire'] }, chance: [0.3, 0.5, 0.75] },
  intro: 'He kept the old kings’ accounts for forty years and died at his desk. Now he writes down every blow you strike.',
};

const MAELIS_CRANE: BossDef = {
  id: 'maelis-crane',
  name: 'Maelis Crane',
  title: 'Lord Chancellor of Aster, once',
  sprite: 'maelis-crane',
  hp: 10500,
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
        // coins of cold ash-gold: each that hits gilds the hero more, and four turn them to gold
        { id: 'spell:gild', w: 3, cd: 4, p: { color: '#e8d07a', type: 'arcane', count: 5, spread: 0.9, speed: 115, gold: 4, share: 0.2, mul: 0.6 } },
        { id: 'summon', w: 1, cd: 16, p: { enemies: ['hired-knife', 'hired-knife'] } },
      ],
    },
    {
      at: 0.5,
      banner: 'The ash-gold grows over Crane! He calls the Host’s assassins!',
      speed: 44,
      rest: [0.5, 0.9],
      enter: [{ id: 'roar', w: 1, cd: 0 }],
      patterns: [
        { id: 'summon', w: 1, cd: 18, p: { enemies: ['ashen-assassin', 'hired-knife'] } },
      ],
    },
  ],
  first: { any: ['vaelors-heartstone'] },
  drops: { items: { any: ['shroud-of-duskspire', 'hollowbrand-shard'] }, chance: [0.3, 0.5, 0.8] },
  intro: 'The Regent’s oldest counselor, who sold the wardens’ map to the Pale Herald. The ash-gold has grown over his hands like scales.',
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
      { id: 'ossuary', floor: 'a', waves: [], boss: 'silas-vey', checkpoint: true, title: 'The Ossuary of Ash-Gold' },
      { id: 'counting-hall', floor: 'c', waves: [], boss: 'the-royal-auditor', checkpoint: true, title: 'The Counting Hall' },
      { id: 'vault', floor: 'b', waves: [], boss: 'maelis-crane', checkpoint: true, title: 'The Old Kings’ Vault' },
    ],
    blurb: 'Under the Crown City, where the Lord Chancellor ran on the Night of Knives and never came up: the Herald’s last hand, the old kings’ Auditor, and Crane himself.',
  },
  bosses: { 'silas-vey': SILAS_VEY, 'the-royal-auditor': ROYAL_AUDITOR, 'maelis-crane': MAELIS_CRANE },
};
