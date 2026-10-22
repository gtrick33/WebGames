import { wildRegion } from '../zonegen';

/**
 * The Saltmarsh Coast (levels 14-20): dunes and salt flats east of Thornvale down to the sea. Mirefin
 * fishfolk raid from the shoals, harpies nest on the cliffs, and smugglers run powder through a cove
 * that leads to their grotto. Gullport is the harbor town.
 */
export const SALTMARSH = wildRegion(
  {
    id: 'saltmarsh',
    name: 'The Saltmarsh Coast',
    subtitle: 'Dunes, shoals and smugglers',
    theme: 'coast',
    levels: [14, 20],
    at: [57, 80],
    dark: false,
    safe: false,
    music: 'coast',
    blurb: 'Fishfolk on the shoals, harpies on the cliffs, smugglers in the cove. Gullport keeps the lights on.',
  },
  {
    w: 160,
    h: 104,
    seed: 52917,
    levels: [14, 20],
    from: [0.04, 0.5],
    forest: 0.16,
    scatter: { trees: 1.2, bushes: 2, rocks: 1, flowers: 3 },
    water: { kind: 'sea', side: 'e', depth: 0.24 },
    sand: 'dunes',
    hubs: [{ at: [0.5, 0.42], npcs: ['harbormaster-quill', 'marla', 'dorran', 'ines'], houses: 6 }],
    exits: [
      { side: 'w', at: 0.5, to: 'thornvale', label: 'The coast road to Thornvale' },
      { side: 'n', at: 0.4, to: 'amberfield', label: 'North road to the Amberfield', minLevel: 15 },
    ],
    pois: [
      { at: [0.68, 0.8], r: 11, kind: 'nest', packs: [['mirefin-skirmisher', 'mirefin-skirmisher', 'mirefin-skirmisher'], ['mirefin-oracle', 'mirefin-spearthrower', 'mirefin-skirmisher'], ['mirefin-spearthrower', 'mirefin-spearthrower']], elite: true, spot: { id: 'mirefin-shoals', name: 'Mirefin Shoals' } },
      { at: [0.26, 0.14], r: 10, kind: 'nest', packs: [['cliff-harpy', 'cliff-harpy'], ['cliff-harpy', 'cliff-harpy', 'cliff-harpy']], rare: 'gullwing', spot: { id: 'gull-cliffs', name: 'Gull Cliffs' } },
      { at: [0.64, 0.16], r: 10, kind: 'wreck', packs: [['smuggler-cutlass', 'smuggler-bomber'], ['smuggler-cutlass', 'smuggler-cutlass']], chest: 'common', spot: { id: 'broken-keel', name: 'The Broken Keel' } },
      { at: [0.56, 0.92], r: 10, kind: 'den', packs: [['shore-crab', 'shore-crab'], ['shore-crab', 'mirefin-skirmisher']], rare: 'old-snapjaw', spot: { id: 'crabclaw-strand', name: 'Crabclaw Strand' } },
      { at: [0.68, 0.55], r: 8, kind: 'cave', packs: [['smuggler-cutlass', 'smuggler-bomber', 'smuggler-cutlass']], entrance: { to: 'smugglers-grotto', label: 'Smugglers’ Grotto', minLevel: 18 }, spot: { id: 'smugglers-cove', name: 'Smugglers’ Cove' } },
      { at: [0.22, 0.72], r: 9, kind: 'grove', packs: [['thornback-spider', 'thornback-spider', 'thornback-spider']], spot: { id: 'saltreed', name: 'Saltreed Marsh' } },
      { at: [0.36, 0.42], r: 8, kind: 'ruin', packs: [['mirefin-skirmisher', 'mirefin-spearthrower', 'mirefin-skirmisher']], chest: 'rare', spot: { id: 'drowned-chapel', name: 'The Drowned Chapel' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['mirefin-skirmisher', 'mirefin-skirmisher', 'mirefin-skirmisher'], ['smuggler-cutlass', 'smuggler-bomber'], ['shore-crab'], ['thornback-spider', 'thornback-spider']] },
      { band: [0.3, 0.7], packs: [['mirefin-skirmisher', 'mirefin-spearthrower', 'mirefin-skirmisher'], ['cliff-harpy', 'cliff-harpy'], ['shore-crab', 'mirefin-skirmisher']] },
      { band: [0.6, 1], packs: [['smuggler-cutlass', 'smuggler-cutlass', 'smuggler-bomber'], ['mirefin-oracle', 'mirefin-skirmisher', 'mirefin-skirmisher', 'mirefin-spearthrower'], ['cliff-harpy', 'cliff-harpy', 'cliff-harpy']] },
    ],
    wildCount: 55,
  },
);
