import { wildRegion } from '../zonegen';

/**
 * Greyfen Marsh (11-17): reeds, fog and drowned villages south of the Brackenridge Hills. Reedwater
 * stands on stilts in the north, between the roads from the hills and from Thornvale; the marsh gets
 * deeper and deadlier to the south-west, toward the Sunken Hamlet, Hag's Hollow and the causeway to
 * Duskfen, where the sickness comes from.
 */
export const GREYFEN = wildRegion(
  {
    id: 'greyfen',
    name: 'Greyfen Marsh',
    subtitle: 'The drowned villages',
    theme: 'marsh',
    levels: [11, 17],
    at: [21, 72],
    dark: false,
    safe: false,
    music: 'forest',
    blurb: 'Reeds, fog and villages lost to the water. Something has been digging up their dead.',
  },
  {
    w: 150,
    h: 108,
    seed: 77213,
    levels: [11, 17],
    // the marsh deepens with distance from Reedwater, between the two roads in
    from: [0.62, 0.26],
    forest: 0.22,
    scatter: { trees: 1.6, bushes: 2.4, rocks: 0.4, flowers: 4 },
    water: { kind: 'lakes', amount: 0.6 },
    sand: 'shore',
    hubs: [{ at: [0.62, 0.3], npcs: ['marshwarden-tilde', 'old-ferris', 'nella'], houses: 5 }],
    exits: [
      { side: 'n', at: 0.5, to: 'brackenridge', label: 'North path to Brackenridge' },
      { side: 'e', at: 0.55, to: 'thornvale', label: 'East road to Thornvale' },
      { side: 'w', at: 0.6, to: 'duskfen', label: 'West causeway to Duskfen', minLevel: 17 },
    ],
    pois: [
      { at: [0.74, 0.4], r: 9, kind: 'ruin', packs: [['bog-ghoul', 'bog-ghoul'], ['bog-hag', 'bog-ghoul'], ['bog-ghoul', 'bloated-drowned']], chest: 'common', spot: { id: 'old-churchyard', name: 'The Old Churchyard' } },
      { at: [0.82, 0.12], r: 8, kind: 'grove', packs: [['marsh-wisp', 'marsh-wisp'], ['marsh-wisp']], spot: { id: 'heron-isle', name: 'Heron Isle' } },
      { at: [0.72, 0.62], r: 10, kind: 'nest', packs: [['marsh-strider', 'marsh-strider'], ['marsh-strider'], ['marsh-strider', 'marsh-wisp']], rare: 'longshanks', spot: { id: 'strider-pools', name: 'Strider Pools' } },
      { at: [0.4, 0.66], r: 10, kind: 'camp', packs: [['bog-hag', 'bog-ghoul', 'bog-ghoul'], ['bog-hag', 'marsh-wisp'], ['bog-hag', 'drowned-villager']], elite: true, chest: 'common', spot: { id: 'hag-hollow', name: 'Hag’s Hollow' } },
      { at: [0.3, 0.38], r: 11, kind: 'ruin', packs: [['bog-ghoul', 'bog-ghoul'], ['drowned-villager', 'drowned-villager', 'bog-ghoul'], ['bloated-drowned', 'drowned-villager']], rare: 'mother-mire', chest: 'rare', spot: { id: 'sunken-hamlet', name: 'The Sunken Hamlet' } },
      { at: [0.16, 0.86], r: 8, kind: 'wreck', packs: [['drowned-villager', 'drowned-villager'], ['bloated-drowned', 'bloated-drowned', 'bog-ghoul']], chest: 'rare', spot: { id: 'lowmere-mill', name: 'Lowmere Mill' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['bog-ghoul', 'bog-ghoul', 'bog-ghoul'], ['marsh-strider', 'marsh-strider'], ['bog-hag', 'bog-ghoul'], ['bog-hag', 'bog-ghoul', 'bog-ghoul'], ['marsh-wisp', 'marsh-wisp'], ['bog-ghoul', 'bloated-drowned']] },
      { band: [0.3, 0.7], packs: [['bog-ghoul', 'bog-ghoul', 'bog-ghoul'], ['drowned-villager', 'drowned-villager'], ['bog-hag', 'drowned-villager', 'bog-ghoul'], ['marsh-wisp', 'marsh-strider'], ['bloated-drowned', 'bog-ghoul', 'bog-ghoul']] },
      { band: [0.6, 1], packs: [['drowned-villager', 'bloated-drowned', 'bog-ghoul'], ['bog-hag', 'bog-hag', 'bog-ghoul'], ['marsh-strider', 'marsh-strider', 'marsh-strider'], ['drowned-villager', 'drowned-villager', 'marsh-wisp']] },
    ],
    wildCount: 52,
  },
);
