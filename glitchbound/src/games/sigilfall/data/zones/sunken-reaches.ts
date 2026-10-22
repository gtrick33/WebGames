import { wildRegion } from '../zonegen';

/**
 * The Sunken Reaches (46-51): a drowned coast north of Sablewind, where an old harbor city slid into
 * the sea. Its streets run under the tide, and the drowned fleet that struck Stormwatch makes its harbor
 * here under the Tide Lord. Driftwood, a raft-town of salvagers lashed to the old sea wall, holds the
 * south-west shore.
 */
export const SUNKEN_REACHES = wildRegion(
  {
    id: 'sunken-reaches',
    name: 'The Sunken Reaches',
    subtitle: 'The drowned fleet’s harbor',
    theme: 'sunken',
    levels: [46, 51],
    at: [104, -6],
    dark: false,
    safe: false,
    music: 'coast',
    blurb: 'A drowned harbor city under the tide, where the drowned fleet makes its home.',
  },
  {
    w: 160,
    h: 104,
    seed: 73451,
    levels: [46, 51],
    from: [0.2, 0.9],
    forest: 0.22,
    scatter: { trees: 1, bushes: 1.2, rocks: 1.6, flowers: 0.6 },
    water: { kind: 'sea', side: 'e', depth: 0.26 },
    sand: 'shore',
    hubs: [{ at: [0.24, 0.78], npcs: ['captain-isolde', 'mother-kelp', 'salvager-finn'], houses: 5 }],
    exits: [
      { side: 's', at: 0.3, to: 'sablewind', label: 'South road to Sablewind Canyon' },
      { side: 'w', at: 0.45, to: 'bonefields', label: 'West road to the Bonefields', minLevel: 47 },
    ],
    pois: [
      // the drowned fleet's harbor, and its master
      { at: [0.66, 0.2], r: 13, kind: 'wreck', level: 51, packs: [['drowned-marine', 'drowned-marine', 'drowned-gunner'], ['deep-siren', 'drowned-marine'], ['coral-golem', 'drowned-marine', 'drowned-marine']], rare: 'the-tide-lord', spot: { id: 'drowned-harbor', name: 'The Drowned Harbor' }, chest: 'epic' },
      { at: [0.42, 0.42], r: 11, kind: 'ruin', level: 48, packs: [['drowned-marine', 'drowned-chanter'], ['coral-golem', 'tide-lurker']], elite: true, rare: 'old-barnacle', spot: { id: 'sunken-chapel', name: 'The Sunken Chapel' }, landmark: { style: 'temple', w: 5, h: 4, name: 'The Sunken Chapel' }, chest: 'rare' },
      { at: [0.2, 0.3], r: 10, kind: 'grove', level: 47, packs: [['tide-lurker', 'tide-lurker'], ['kraken-spawn', 'kraken-spawn', 'tide-lurker']], spot: { id: 'kelp-forest', name: 'The Kelp Forest' } },
      { at: [0.58, 0.68], r: 10, kind: 'wreck', level: 47, packs: [['drowned-gunner', 'drowned-marine'], ['kraken-spawn', 'kraken-spawn', 'kraken-spawn']], spot: { id: 'shipwreck-reef', name: 'Shipwreck Reef' }, chest: 'common' },
      { at: [0.84, 0.5], r: 9, kind: 'nest', level: 49, packs: [['deep-siren', 'deep-siren'], ['deep-siren', 'tide-lurker', 'tide-lurker']], spot: { id: 'siren-rocks', name: 'The Siren Rocks' } },
      { at: [0.4, 0.86], r: 8, kind: 'ruin', level: 46, packs: [['tide-lurker', 'tide-lurker', 'kraken-spawn']], spot: { id: 'old-sea-wall', name: 'The Old Sea Wall' }, landmark: { style: 'lighthouse', w: 3, h: 5, name: 'The Drowned Light' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['tide-lurker', 'tide-lurker'], ['kraken-spawn', 'kraken-spawn', 'kraken-spawn'], ['drowned-marine', 'tide-lurker'], ['drowned-sailor', 'drowned-sailor', 'drowned-marine']] },
      { band: [0.35, 0.7], packs: [['drowned-marine', 'drowned-marine', 'drowned-gunner'], ['coral-golem', 'tide-lurker'], ['deep-siren', 'kraken-spawn', 'kraken-spawn'], ['drowned-chanter', 'drowned-marine', 'drowned-marine']] },
      { band: [0.65, 1], packs: [['coral-golem', 'drowned-marine', 'drowned-gunner'], ['deep-siren', 'deep-siren', 'drowned-marine'], ['drowned-marine', 'drowned-marine', 'drowned-marine', 'drowned-chanter']] },
    ],
    wildCount: 54,
  },
);
