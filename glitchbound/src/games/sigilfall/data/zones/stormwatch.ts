import { wildRegion } from '../zonegen';

/**
 * Stormwatch Cliffs (26-32): a stormy coast east of the Amberfield, all rain, pines and cliffs over a
 * grey sea. The town of Stormwatch huddles in the lee of Lantern Head, where the great lighthouse keeps
 * the last light on the coast. The Hollow King's drowned fleet comes ashore here: sailors and gunners
 * off black ships, the Drowned Priestess's chanters singing more of them out of the surf, storm harpies
 * and elementals riding a gale somebody ordered. Admiral Blackwake means to put the light out and land
 * his army in the dark. Wrecks line the shore from the Landing Beach to the Shipbreaker Rocks.
 */
export const STORMWATCH = wildRegion(
  {
    id: 'stormwatch',
    name: 'Stormwatch Cliffs',
    subtitle: 'The drowned fleet comes ashore',
    theme: 'storm',
    levels: [26, 32],
    at: [89, 72],
    dark: false,
    safe: false,
    music: 'coast',
    blurb: 'Rain, cliffs and the great lighthouse, under siege by the drowned and the storm they bring.',
  },
  {
    w: 160,
    h: 100,
    seed: 70411,
    levels: [26, 32],
    from: [0.04, 0.4],
    forest: 0.2,
    scatter: { trees: 1.4, bushes: 1.2, rocks: 2.6, flowers: 1.5 },
    water: { kind: 'sea', side: 's', depth: 0.22 },
    sand: 'shore',
    hubs: [{ at: [0.36, 0.46], npcs: ['keeper-ansel', 'captain-morra', 'bosun-pike', 'odile'], houses: 6 }],
    exits: [
      { side: 'w', at: 0.4, to: 'amberfield', label: 'West road to the Amberfield' },
      { side: 'e', at: 0.35, to: 'vinecoil', label: 'East road to Vinecoil Jungle', minLevel: 38 },
    ],
    pois: [
      // the finale: the Admiral comes ashore under the light with his honor guard
      { at: [0.52, 0.76], r: 11, kind: 'ruin', level: 30, packs: [['barnacle-brute', 'drowned-sailor', 'drowned-sailor'], ['drowned-gunner', 'drowned-chanter', 'drowned-sailor'], ['drowned-gunner', 'drowned-gunner']], elite: true, rare: 'admiral-blackwake', spot: { id: 'lighthouse-point', name: 'Lighthouse Point' }, landmark: { style: 'lighthouse', w: 3, h: 3, name: 'The Stormwatch Light' } },
      { at: [0.17, 0.74], r: 9, kind: 'wreck', level: 27, packs: [['drowned-sailor', 'drowned-sailor'], ['drowned-gunner', 'drowned-sailor']], spot: { id: 'landing-beach', name: 'The Landing Beach' } },
      { at: [0.26, 0.26], r: 8, kind: 'grove', packs: [['drowned-sailor', 'drowned-sailor']], spot: { id: 'sailors-rest', name: 'The Sailors’ Rest' } },
      { at: [0.1, 0.16], r: 10, kind: 'nest', level: 28, packs: [['storm-harpy', 'storm-harpy'], ['storm-harpy', 'storm-harpy', 'storm-harpy']], rare: 'galemother', spot: { id: 'gale-roost', name: 'Gale Roost' } },
      { at: [0.44, 0.1], r: 9, kind: 'ruin', level: 27, packs: [['storm-harpy', 'storm-harpy'], ['storm-harpy', 'storm-wisp', 'storm-wisp']], chest: 'common', spot: { id: 'old-beacon', name: 'The Old Beacon' } },
      { at: [0.64, 0.3], r: 11, kind: 'ruin', level: 29, packs: [['storm-elemental', 'storm-wisp', 'storm-wisp'], ['storm-elemental', 'storm-harpy'], ['storm-elemental', 'storm-elemental']], elite: true, chest: 'rare', spot: { id: 'storm-circle', name: 'The Storm Circle' } },
      { at: [0.88, 0.38], r: 11, kind: 'camp', level: 30, packs: [['drowned-chanter', 'drowned-sailor', 'drowned-sailor'], ['barnacle-brute', 'drowned-gunner'], ['drowned-gunner', 'drowned-gunner', 'drowned-sailor']], elite: true, chest: 'common', spot: { id: 'black-camp', name: 'The Black Camp' } },
      { at: [0.76, 0.73], r: 11, kind: 'wreck', level: 29, packs: [['drowned-sailor', 'drowned-sailor', 'drowned-gunner'], ['barnacle-brute', 'drowned-sailor']], rare: 'captain-gloam', chest: 'rare', spot: { id: 'wreck-of-the-gloam', name: 'The Wreck of the Gloam' } },
      { at: [0.95, 0.66], r: 9, kind: 'den', packs: [['shore-crab', 'shore-crab'], ['barnacle-brute', 'shore-crab']], spot: { id: 'shipbreaker-rocks', name: 'The Shipbreaker Rocks' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['drowned-sailor', 'drowned-sailor', 'drowned-sailor'], ['storm-harpy', 'storm-harpy', 'storm-harpy'], ['shore-crab', 'shore-crab', 'drowned-sailor'], ['drowned-sailor', 'drowned-sailor', 'drowned-gunner'], ['storm-wisp', 'storm-wisp', 'storm-wisp', 'storm-wisp']] },
      { band: [0.35, 0.7], packs: [['drowned-sailor', 'drowned-sailor', 'drowned-gunner', 'drowned-gunner'], ['storm-elemental', 'storm-wisp', 'storm-wisp'], ['barnacle-brute', 'drowned-sailor', 'drowned-gunner'], ['storm-harpy', 'storm-harpy', 'storm-harpy'], ['drowned-chanter', 'drowned-sailor', 'drowned-sailor']] },
      { band: [0.65, 1], packs: [['drowned-chanter', 'drowned-sailor', 'drowned-sailor', 'drowned-gunner'], ['barnacle-brute', 'drowned-gunner', 'drowned-gunner'], ['storm-elemental', 'storm-elemental', 'storm-harpy', 'storm-wisp'], ['drowned-gunner', 'drowned-gunner', 'drowned-sailor', 'drowned-sailor']] },
    ],
    wildCount: 58,
  },
);
