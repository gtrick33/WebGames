import { wildRegion } from '../zonegen';

/**
 * The Grimward Moors (29-35), Act III (see WORLD.md): grey heath north of the Ashen Barrows, all
 * heather, tarns, gibbets and standing stones. The hunters' town of Grimward huddles behind its ditch
 * and stakes in the south-east. The Hollow King's curse has come to the moor: the wolves run bold,
 * bitten men turn, and the Legion's Hollow Hunters ride with the packs. The Wolfmoot lies north-east
 * of town, the Hunters' Camp west, Hob's Old Mill east, the Crow Gibbets at the crossroads north, the
 * Black Dog's Cairn south-west by the old road, and the Howling Stones, where Moonfang holds court, in
 * the far north-west.
 */
export const GRIMWARD = wildRegion(
  {
    id: 'grimward',
    name: 'The Grimward Moors',
    subtitle: 'The King’s curse runs on four legs',
    theme: 'moor',
    levels: [29, 35],
    at: [52, 22],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Grey heath, gibbets and standing stones, and wolves that walk like men under the King’s curse.',
  },
  {
    w: 150,
    h: 104,
    seed: 52211,
    levels: [29, 35],
    from: [0.6, 0.96],
    forest: 0.16,
    scatter: { trees: 1.1, bushes: 2.4, rocks: 1.8, flowers: 2.2 },
    water: { kind: 'lakes', amount: 0.35 },
    hubs: [{ at: [0.55, 0.7], npcs: ['huntmaster-orla', 'innkeep-bram', 'tinker-vey', 'carter-joss'], houses: 6 }],
    exits: [
      { side: 's', at: 0.6, to: 'ashen-barrows', label: 'South road to the Ashen Barrows' },
      { side: 'w', at: 0.45, to: 'glimmerwood', label: 'West road to the Glimmerwood', minLevel: 30 },
      { side: 'n', at: 0.5, to: 'shattered-vale', label: 'North pass to the Shattered Vale', minLevel: 34 },
    ],
    pois: [
      // the chain's end: Moonfang holds court among the standing stones
      {
        at: [0.3, 0.25],
        r: 11,
        kind: 'ruin',
        level: 34,
        packs: [
          ['werewolf', 'werewolf', 'werewolf-howler'],
          ['werewolf-howler', 'werewolf', 'moor-wolf'],
          ['werewolf', 'moor-wolf', 'moor-wolf'],
        ],
        elite: true,
        rare: 'moonfang',
        spot: { id: 'howling-stones', name: 'The Howling Stones' },
        chest: 'rare',
      },
      {
        at: [0.75, 0.3],
        r: 10,
        kind: 'den',
        level: 33,
        packs: [
          ['werewolf-howler', 'moor-wolf', 'moor-wolf'],
          ['werewolf', 'werewolf-howler'],
          ['werewolf-howler', 'werewolf', 'moor-wolf'],
        ],
        spot: { id: 'wolfmoot', name: 'The Wolfmoot' },
        chest: 'common',
      },
      {
        at: [0.2, 0.6],
        r: 10,
        kind: 'camp',
        level: 31,
        packs: [
          ['hollow-hunter', 'hollow-hunter', 'moor-wolf'],
          ['hollow-hunter', 'werewolf'],
          ['hollow-hunter', 'hollow-hunter'],
        ],
        spot: { id: 'hunters-camp', name: 'The Hollow Hunters’ Camp' },
        chest: 'common',
      },
      {
        at: [0.8, 0.65],
        r: 9,
        kind: 'farm',
        level: 31,
        packs: [
          ['moor-wolf', 'moor-wolf', 'moor-wolf'],
          ['moor-wolf', 'werewolf'],
        ],
        rare: 'hob',
        spot: { id: 'old-mill', name: 'Hob’s Old Mill' },
        landmark: { style: 'house', w: 4, h: 3, name: 'Hob’s Mill' },
      },
      {
        at: [0.5, 0.4],
        r: 9,
        kind: 'nest',
        level: 32,
        packs: [
          ['gibbet-crow', 'gibbet-crow', 'gibbet-crow'],
          ['gibbet-crow', 'gibbet-crow', 'hollow-hunter'],
        ],
        rare: 'gallowmaw',
        spot: { id: 'crow-gibbets', name: 'The Crow Gibbets' },
      },
      {
        at: [0.3, 0.86],
        r: 8,
        kind: 'ruin',
        level: 31,
        packs: [
          ['moor-wolf', 'moor-wolf'],
          ['werewolf', 'moor-wolf'],
        ],
        rare: 'barghest',
        spot: { id: 'black-dog-cairn', name: 'The Black Dog’s Cairn' },
      },
    ],
    wild: [
      { band: [0, 0.4], packs: [['moor-wolf', 'moor-wolf'], ['moor-wolf', 'moor-wolf', 'moor-wolf'], ['gibbet-crow', 'gibbet-crow'], ['hollow-hunter', 'moor-wolf'], ['werewolf']] },
      { band: [0.3, 0.7], packs: [['werewolf', 'moor-wolf'], ['hollow-hunter', 'hollow-hunter', 'moor-wolf'], ['gibbet-crow', 'gibbet-crow', 'gibbet-crow'], ['werewolf-howler', 'moor-wolf'], ['werewolf', 'hollow-hunter']] },
      { band: [0.6, 1], packs: [['werewolf', 'werewolf'], ['werewolf-howler', 'werewolf'], ['hollow-hunter', 'hollow-hunter', 'werewolf'], ['werewolf', 'moor-wolf', 'moor-wolf']] },
    ],
    wildCount: 54,
  },
);
