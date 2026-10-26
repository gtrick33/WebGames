import type { DungeonModule } from '.';
import type { BossDef } from '../bosses';
import { is, not, until } from '../cond';
import type { Marker, PlacedMarkerDef } from '../types';

/*
 * Vaelmoor Remembered (level 60): the finale's second and fourth stages (STORY_BIBLE.md §3, Crownfall). When
 * Vaelor falls the Ash Crown pulls the throne room into the only thing it has left: its memory of Vaelmoor the
 * summer before the plague, whole and beautiful. A road of warm stone comes up into the palace square, where
 * Elyra waits with the seven sigils lit and the King's family stands as he remembers them; there the hero
 * makes Elyra's choice. North of the square, through the palace garden gate, the Crown gathers itself into its
 * last form. The square is no room (nothing seals or spawns there); the garden is the boss's.
 */
const MAP = [
  '##################################################',
  '##################################################',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaQaaaaaaaaaaaaaaaaaaaaaaaaQaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaVaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaajaaaaaaaaaaaaaaaaaajaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaaaajaaaaaaaaaaaaaaaaaajaaaaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '##########aaQaaaaaaaaaaaaaaaaaaaaaaaaQaa##########',
  '##########aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa##########',
  '#######################DDDD#######################',
  '#######################::::#######################',
  '#######################::::#######################',
  '######...,..,.,.,..........,...........,,...######',
  '######....::::::::::::::::::::::::::::::....######',
  '######..,.:::T,:::::::::::::::::::::T,::....######',
  '######.,..:::,,:::::::::::::::::::::,,::....######',
  '######,...:::::::::,,::::::::::,,:::::::....######',
  '######....:::::::::,,::::::::::,,:::::::...,######',
  '######....::::::::::::::::::::::::::::::....######',
  '######....:::T,:::::::::::::::::::::T,::....######',
  '######....:::,,:::::::::::::::::::::,,::....######',
  '######...,..,.....,...........,........,.,..######',
  '#######################::::#######################',
  '#######################::::#######################',
  '#######################::P:#######################',
  '#######################::::#######################',
  '##########################X#######################',
  '##################################################',
];

const markers: Record<string, Marker> = {
  P: { kind: 'start' },
  X: { kind: 'exit', to: 'pale-reach', label: 'Out through the tear, to the Pale Reach' },
  V: { kind: 'boss', boss: 'the-ash-crown' },
};

/** The palace square: who stands in the memory, and what the hour changes (Elyra's choice). */
const placed: PlacedMarkerDef[] = [
  { tx: 25, ty: 23, marker: { kind: 'npc', npc: 'elyra-in-the-memory' } },
  { tx: 15, ty: 21, marker: { kind: 'npc', npc: 'echo-of-ysane-whole' }, when: until('crownfall-the-ash-crown') },
  { tx: 13, ty: 22, marker: { kind: 'npc', npc: 'echo-of-the-children' }, when: until('crownfall-the-ash-crown') },
  // the King stands at the edge of the square until the hour is given or refused
  { tx: 34, ty: 21, marker: { kind: 'npc', npc: 'vaelor-remembered' }, when: not(is('crownfall-break-it', 'taken')) },
  // the hour: the King on the fountain's rim with his family
  { tx: 25, ty: 20, marker: { kind: 'prop', prop: 'well', solid: true } },
  { tx: 18, ty: 19, marker: { kind: 'prop', prop: 'blue-banner' } },
  { tx: 32, ty: 19, marker: { kind: 'prop', prop: 'blue-banner' } },
  { tx: 10, ty: 24, marker: { kind: 'prop', prop: 'market-cart', solid: true } },
  { tx: 40, ty: 24, marker: { kind: 'prop', prop: 'market-cart', solid: true } },
  { tx: 12, ty: 27, marker: { kind: 'prop', prop: 'bench', solid: true } },
  { tx: 38, ty: 27, marker: { kind: 'prop', prop: 'bench', solid: true } },
  { tx: 20, ty: 26, marker: { kind: 'prop', prop: 'lantern' } },
  { tx: 30, ty: 26, marker: { kind: 'prop', prop: 'lantern' } },
  { tx: 8, ty: 20, marker: { kind: 'npc', npc: 'vaelmoor-baker' } },
  { tx: 42, ty: 21, marker: { kind: 'npc', npc: 'vaelmoor-herald-boy' } },
  // where the scenes look
  { tx: 25, ty: 22, marker: { kind: 'place', id: 'memory-square' } },
  { tx: 25, ty: 17, marker: { kind: 'place', id: 'memory-gate' } },
  // the hour taken: four of them at the fountain, once he has had it
  { tx: 27, ty: 21, marker: { kind: 'prop', prop: 'flag' }, when: is('crownfall-one-hour', 'taken') },
  // the Crown broken at once: where he stood, only ash
  { tx: 34, ty: 22, marker: { kind: 'prop', prop: 'debris' }, when: is('crownfall-break-it', 'taken') },
];

const THE_ASH_CROWN: BossDef = {
  id: 'the-ash-crown',
  name: 'The Ash Crown',
  title: 'What the King wore',
  sprite: 'the-ash-crown',
  hp: 12000,
  dmg: 34,
  radius: 14,
  xp: 9000,
  gold: [2000, 3000],
  floats: true,
  phases: [
    {
      // a kingdom's grief, thrown at you a handful at a time
      at: 1,
      speed: 36,
      rest: [0.7, 1.1],
      patterns: [
        { id: 'orbs', w: 3, cd: 4.5, p: { count: 7, speed: 70, homing: 0.8, mul: 0.8, color: '#c8c0d8' } },
        { id: 'riftSpiral', w: 2, cd: 9, p: { arms: 3, time: 2.6 } },
        { id: 'graveGrasp', w: 2, cd: 6, p: { count: 4 } },
        { id: 'teleport', w: 1, cd: 9 },
      ],
    },
    {
      at: 0.6,
      banner: 'The Crown remembers every grief it ever ate',
      speed: 40,
      rest: [0.6, 1],
      enter: [{ id: 'roar', w: 1, cd: 0 }],
      patterns: [
        { id: 'summon', w: 1, cd: 18, p: { enemies: ['wailing-soul', 'wailing-soul', 'kneeling-dead'] } },
        { id: 'tide', w: 3, cd: 7, p: { speed: 95, gap: 3, form: 1, waves: 2, gapT: 1.1, mul: 1.1, color: '#c8c0d8' } },
        { id: 'riftBeams', w: 2, cd: 10, p: { beams: 3 } },
        { id: 'orbs', w: 2, cd: 5, p: { count: 8, speed: 75, homing: 1, mul: 0.8, color: '#e8d8a8' } },
        { id: 'teleport', w: 1, cd: 8 },
      ],
    },
    {
      at: 0.25,
      banner: 'Only ash is left, and it will not go quietly',
      speed: 46,
      rest: [0.45, 0.8],
      enter: [{ id: 'collapse', w: 1, cd: 0 }],
      patterns: [
        { id: 'riftNova', w: 2, cd: 8 },
        { id: 'orbs', w: 3, cd: 4, p: { count: 10, speed: 80, homing: 1.1, mul: 0.8, color: '#e8d8a8' } },
        { id: 'riftSpiral', w: 2, cd: 8, p: { arms: 4, time: 2.3 } },
        { id: 'tide', w: 2, cd: 8, p: { speed: 105, gap: 3, form: 0.9, waves: 2, gapT: 0.95, mul: 1.1, color: '#c8c0d8' } },
      ],
    },
  ],
  first: { any: ['vaelors-heartstone'] },
  drops: { items: { any: ['vaelors-heartstone', 'shroud-of-duskspire', 'hollowbrand-shard'] }, chance: [0.4, 0.6, 1] },
  intro: 'Not a crown any more: a shape of grey ash and borrowed summer, as tall as the garden wall, with seven empty points where the stars should be.',
};

export const VAELMOOR_REMEMBERED: DungeonModule = {
  region: {
    id: 'vaelmoor-remembered',
    name: 'Vaelmoor Remembered',
    subtitle: 'The summer before the plague',
    // the memory is outdoors and in summer: the Vale's own art, a paved square, the palace garden's woods round it
    theme: 'village',
    kind: 'dungeon',
    level: 60,
    levels: [60, 60],
    at: [56, -74],
    dark: false,
    safe: false,
    music: 'village',
    map: MAP,
    markers,
    placed,
    states: [{ id: 'summer', when: until('crownfall-the-ash-crown'), dusk: true }],
    encounters: [{ id: 'garden', floor: 'a', waves: [], boss: 'the-ash-crown', checkpoint: true, title: 'The Palace Garden' }],
    blurb: 'The Ash Crown’s memory of Vaelmoor whole: warm stone, banners and a market square, the summer before the plague.',
  },
  bosses: { 'the-ash-crown': THE_ASH_CROWN },
};
