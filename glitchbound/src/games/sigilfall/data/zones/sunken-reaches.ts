import { after, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * The Sunken Reaches (49-52), Act V: Vaelmoor's drowned coast north of Sablewind, where Lowhaven, the Dead
 * Kingdom's harbor, slid into the sea the night Vaelmoor died. Its streets run under the tide, and the
 * drowned fleet that struck Stormwatch makes its harbor here under the Tide Lord, Lowhaven's last
 * Harbor-Lord. Driftwood, a raft-town of salvagers lashed to the old sea wall, holds the south-west
 * shore; the Drowned Light stands on the wall east of it. The Kelp Forest grows in the north-west,
 * the Sunken Chapel's bell rings at low water in the middle of the old city, Shipwreck Reef lies
 * south-east, the sirens sing on the rocks out in the bay, and the Drowned Harbor is in the far
 * north-east.
 *
 * What changes: the masts of the drowned fleet stand in the harbor and Ysane's echo waits on the sea wall until
 * the fireships go in; after, the harbor smokes and Driftwood flies the Crown's colors.
 */
export const SUNKEN_REACHES = wildRegion(
  {
    id: 'sunken-reaches',
    name: 'The Sunken Reaches',
    subtitle: 'The drowned fleet’s harbor',
    theme: 'sunken',
    levels: [49, 52],
    at: [104, -6],
    dark: false,
    safe: false,
    music: 'sunken-reaches',
    blurb: 'Vaelmoor’s drowned harbor city under the tide, where the drowned fleet makes its home.',
    states: [{ id: 'fleet-burned', when: after('the-fireships'), smoke: true }],
  },
  {
    w: 160,
    h: 104,
    seed: 73451,
    levels: [49, 52],
    from: [0.2, 0.9],
    forest: 0.22,
    scatter: { trees: 1, bushes: 1.2, rocks: 1.6, flowers: 0.6 },
    water: { kind: 'sea', side: 'e', depth: 0.28 },
    sand: 'shore',
    hubs: [{ at: [0.24, 0.78], plan: 'street', npcs: ['captain-isolde', 'mother-kelp', 'salvager-finn', 'diver-mabry'], houses: 5 }],
    exits: [
      { side: 's', at: 0.3, to: 'sablewind', label: 'South road to Sablewind Canyon' },
      { side: 'w', at: 0.45, to: 'bonefields', label: 'West road to the Bonefields' },
    ],
    pois: [
      // the drowned fleet's harbor, and its master
      {
        at: [0.66, 0.2],
        r: 13,
        kind: 'wreck',
        level: 52,
        packs: [
          ['drowned-marine', 'drowned-marine', 'drowned-gunner'],
          ['deep-siren', 'drowned-marine'],
          ['coral-golem', 'drowned-marine', 'drowned-marine'],
          ['drowned-chanter', 'drowned-gunner'],
        ],
        rare: 'the-tide-lord',
        spot: { id: 'drowned-harbor', name: 'The Drowned Harbor' },
        chest: 'epic',
        // the harbor's crews go down with their master, so the quay is clear for the fireships
        when: until('the-tide-lord'),
      },
      // the old city's chapel, where Old Barnacle wears the bell
      {
        at: [0.42, 0.42],
        r: 11,
        kind: 'ruin',
        level: 50,
        packs: [
          ['drowned-marine', 'drowned-chanter'],
          ['coral-golem', 'tide-lurker'],
          ['coral-golem', 'drowned-marine'],
        ],
        elite: true,
        rare: 'old-barnacle',
        spot: { id: 'sunken-chapel', name: 'The Sunken Chapel' },
        landmark: { style: 'temple', w: 5, h: 4, name: 'The Sunken Chapel' },
        chest: 'rare',
      },
      { at: [0.2, 0.3], r: 10, kind: 'grove', level: 50, packs: [['tide-lurker', 'tide-lurker'], ['kraken-spawn', 'kraken-spawn', 'tide-lurker'], ['kraken-spawn', 'kraken-spawn', 'kraken-spawn']], spot: { id: 'kelp-forest', name: 'The Kelp Forest' } },
      { at: [0.58, 0.68], r: 10, kind: 'wreck', level: 50, packs: [['drowned-gunner', 'drowned-marine'], ['kraken-spawn', 'kraken-spawn', 'kraken-spawn'], ['drowned-gunner', 'drowned-sailor', 'drowned-sailor']], spot: { id: 'shipwreck-reef', name: 'Shipwreck Reef' }, chest: 'common' },
      { at: [0.84, 0.5], r: 9, kind: 'nest', level: 51, packs: [['deep-siren', 'deep-siren'], ['deep-siren', 'tide-lurker', 'tide-lurker']], spot: { id: 'siren-rocks', name: 'The Siren Rocks' } },
      { at: [0.4, 0.86], r: 8, kind: 'ruin', level: 49, packs: [['drowned-sailor', 'drowned-sailor', 'drowned-marine'], ['tide-lurker', 'kraken-spawn', 'kraken-spawn']], spot: { id: 'old-sea-wall', name: 'The Old Sea Wall' }, landmark: { style: 'lighthouse', w: 3, h: 5, name: 'The Drowned Light' } },
    ],
    wild: [
      {
        band: [0, 0.4],
        packs: [
          ['tide-lurker', 'tide-lurker'],
          ['kraken-spawn', 'kraken-spawn', 'kraken-spawn'],
          ['drowned-marine', 'tide-lurker'],
          ['drowned-sailor', 'drowned-sailor', 'drowned-marine'],
          ['drowned-gunner', 'drowned-sailor', 'drowned-sailor'],
          ['coral-golem', 'kraken-spawn', 'kraken-spawn'],
        ],
      },
      {
        band: [0.35, 0.7],
        packs: [
          ['drowned-marine', 'drowned-marine', 'drowned-gunner'],
          ['coral-golem', 'tide-lurker'],
          ['deep-siren', 'kraken-spawn', 'kraken-spawn'],
          ['drowned-chanter', 'drowned-marine', 'drowned-marine'],
          ['deep-siren', 'drowned-sailor', 'drowned-sailor'],
        ],
      },
      {
        band: [0.65, 1],
        packs: [
          ['coral-golem', 'drowned-marine', 'drowned-gunner'],
          ['deep-siren', 'deep-siren', 'drowned-marine'],
          ['drowned-marine', 'drowned-marine', 'drowned-marine', 'drowned-chanter'],
          ['drowned-gunner', 'drowned-gunner', 'drowned-marine'],
        ],
      },
    ],
    wildCount: 54,
    story: [
      // Ysane's echo on the sea wall, every evening, until the harbor burns
      { near: 'old-sea-wall', dx: 3, dy: 2, marker: { kind: 'npc', npc: 'echo-of-ysane-quay' }, when: until('the-fireships') },
      { near: 'old-sea-wall', dx: 3, dy: 1, marker: { kind: 'wisp', color: '#c8c4dc', size: 1 }, when: until('the-fireships') },
      // the quay at the Drowned Harbor, where Isolde brings the fireships in
      { near: 'drowned-harbor', dx: -4, dy: 10, marker: { kind: 'place', id: 'harbor-quay' } },
      { near: 'drowned-harbor', dx: 0, dy: 0, marker: { kind: 'place', id: 'quay-n' } },
      { near: 'drowned-harbor', dx: -16, dy: 8, marker: { kind: 'place', id: 'quay-w' } },
      { near: 'drowned-harbor', dx: 8, dy: 14, marker: { kind: 'place', id: 'quay-e' } },
      // after: Driftwood flies the Crown's colors
      { near: 'hub', dx: 0, dy: -5, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('the-fireships') },
      { near: 'drowned-harbor', dx: -4, dy: 12, marker: { kind: 'prop', prop: 'debris' }, when: after('the-fireships') },
    ],
  },
);
