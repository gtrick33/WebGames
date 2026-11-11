import type { DungeonModule } from '.';
import { is, not, until } from '../cond';
import type { Marker, PlacedMarkerDef } from '../types';

/*
 * Vaelmoor Remembered (level 60): the finale's last stage (STORY_BIBLE.md §4, Crownfall). When the Hallow King falls
 * and the Sigil of Stone comes back out of his crown, the Ash Crown, robbed of its only star, pulls the throne room into
 * the only thing it has left: its memory of Vaelmoor the summer before the plague, whole and beautiful. A road of warm
 * stone comes up into the palace square, where Elyra waits with all seven sigils lit and the King's family stands as
 * he remembers them; there the hero makes Elyra's choice. North of the square, over the palace garden, the Crown hangs
 * turning, with nothing left to hold it up but grief: there Elyra unmakes it, and the way home opens. No room here
 * seals and nothing is fought: the last fight was the King's.
 */
const MAP = [
  '##################################################',
  '##################################################',
  '##########T,..,.T..,...,::::,...,..T.,.,##########',
  '##########.,..Q.......,.::::.,.......Q,.##########',
  '##########,..........,..::::..,.........##########',
  '##########..,....,......::::......,...,.##########',
  '##########....,.......,.::::.,.......,..##########',
  '##########.,...j.....,..::::..,.....j..,##########',
  '##########..,..........,::::,..........,##########',
  '##########,.....,.......::::.......,....##########',
  '##########..,...........::::..,.......,.##########',
  '##########.,...j.,......::::......,.j..,##########',
  '##########...,......,...::::...,......,.##########',
  '##########,.....,.......::::.......,....##########',
  '##########.,..Q...,.....::::.....,...Q,.##########',
  '##########T..,..,T..,...::::...,..T..,.T##########',
  '#######################::::#######################',
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
  '######...,..,.....,......P....,........,.,..######',
  '#######################::::#######################',
  '#######################::::#######################',
  '#######################::::#######################',
  '#######################::::#######################',
  '##########################X#######################',
  '##################################################',
];

const markers: Record<string, Marker> = {
  P: { kind: 'start' },
  X: { kind: 'exit', to: 'pale-reach', label: 'Out through the tear, to the Pale Reach' },
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
  { tx: 25, ty: 7, marker: { kind: 'place', id: 'memory-crown' } },
  // the Ash Crown over the garden, turning, until Elyra unmakes it
  { tx: 25, ty: 2, marker: { kind: 'prop', prop: 'great:ash-crown' }, when: until('crownfall-the-ash-crown') },
  { tx: 25, ty: 9, marker: { kind: 'spot', id: 'memory-garden', name: 'The Palace Garden', r: 3 } },
  // the hour taken: four of them at the fountain, once he has had it
  { tx: 27, ty: 21, marker: { kind: 'prop', prop: 'flag' }, when: is('crownfall-one-hour', 'taken') },
  // the Crown broken at once: where he stood, only ash
  { tx: 34, ty: 22, marker: { kind: 'prop', prop: 'debris' }, when: is('crownfall-break-it', 'taken') },
];

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
    at: [68, -78],
    dark: false,
    safe: false,
    music: 'village',
    map: MAP,
    markers,
    placed,
    states: [{ id: 'summer', when: until('crownfall-the-ash-crown'), dusk: true }],
    encounters: [],
    // the Crown unmade: the way home opens in the garden
    homeAfter: 'crownfall-the-ash-crown',
    blurb: 'The Ash Crown’s memory of Vaelmoor whole: warm stone, banners and a market square, the summer before the plague.',
  },
  bosses: {},
};
