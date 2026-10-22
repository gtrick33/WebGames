import { wildRegion } from '../zonegen';

/**
 * The Shattered Vale (35-41), Act III (see WORLD.md): a broken valley north of the Grimward Moors,
 * where shards of the Rift jut from the ground, the light goes purple and crystal spires grow like
 * trees. Shardwatch, a camp of scholars and the Regent's soldiers, keeps its tower in the south and
 * watches the Tear at the top of the Vale, a wound that bleeds Rift-light. The Crystal Fields lie
 * west of camp, the voidcallers' Breach Camp east, the Wyrm Spires in the far north-east and the
 * abandoned Old Watch in the south-west.
 */
export const SHATTERED_VALE = wildRegion(
  {
    id: 'shattered-vale',
    name: 'The Shattered Vale',
    subtitle: 'Where the Rift bleeds',
    theme: 'rift',
    levels: [35, 41],
    at: [52, 4],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Shards of the Rift jut from a broken valley; what comes through them is hungry.',
  },
  {
    w: 150,
    h: 104,
    seed: 90917,
    levels: [35, 41],
    from: [0.5, 0.96],
    forest: 0.24,
    scatter: { trees: 1.6, bushes: 0.8, rocks: 2.2, flowers: 1.2 },
    water: { kind: 'lakes', amount: 0.3 },
    hubs: [{ at: [0.5, 0.75], npcs: ['magister-quell', 'scholar-ennis', 'shardwife-hesk', 'sergeant-dace'], houses: 4 }],
    exits: [
      { side: 's', at: 0.5, to: 'grimward', label: 'South pass to the Grimward Moors' },
      { side: 'e', at: 0.4, to: 'highwall', label: 'East road to Highwall March', minLevel: 39 },
    ],
    pois: [
      // the Regent's soldiers camp under their watchtower beside Shardwatch
      { at: [0.6, 0.67], r: 6, kind: 'camp', packs: [], landmark: { style: 'tower', w: 3, h: 3, name: 'Shardwatch Tower' } },
      // the chain's end: the Tearborn holds the wound open at the top of the Vale
      {
        at: [0.5, 0.22],
        r: 12,
        kind: 'ruin',
        level: 40,
        packs: [
          ['shard-golem', 'rift-stalker'],
          ['voidcaller', 'rift-stalker', 'rift-shardling'],
          ['rift-stalker', 'rift-stalker', 'shard-golem'],
        ],
        elite: true,
        rare: 'the-tearborn',
        spot: { id: 'the-tear', name: 'The Tear' },
        chest: 'rare',
      },
      {
        at: [0.2, 0.45],
        r: 11,
        kind: 'grove',
        level: 36,
        packs: [
          ['rift-shardling', 'rift-shardling', 'rift-shardling'],
          ['shard-golem', 'rift-shardling'],
          ['shard-golem'],
        ],
        rare: 'the-glass-matron',
        spot: { id: 'crystal-fields', name: 'The Crystal Fields' },
      },
      {
        at: [0.8, 0.52],
        r: 10,
        kind: 'camp',
        level: 37,
        packs: [
          ['voidcaller', 'rift-stalker'],
          ['voidcaller', 'voidcaller', 'rift-shardling'],
          ['voidcaller', 'shard-golem'],
        ],
        spot: { id: 'breach-camp', name: 'The Breach Camp' },
        chest: 'common',
      },
      {
        at: [0.78, 0.15],
        r: 10,
        kind: 'nest',
        level: 38,
        packs: [
          ['rift-wyrm', 'rift-wyrm'],
          ['rift-wyrm', 'rift-wyrm'],
        ],
        rare: 'old-coil',
        spot: { id: 'wyrm-spires', name: 'The Wyrm Spires' },
      },
      {
        at: [0.15, 0.82],
        r: 9,
        kind: 'ruin',
        level: 37,
        packs: [
          ['rift-stalker', 'rift-stalker'],
          ['rift-stalker', 'rift-shardling', 'rift-shardling'],
        ],
        rare: 'the-flicker',
        spot: { id: 'old-watch', name: 'The Old Watch' },
        landmark: { style: 'tower', w: 3, h: 3, name: 'The Old Watch' },
      },
    ],
    wild: [
      { band: [0, 0.4], packs: [['rift-shardling', 'rift-shardling'], ['rift-stalker', 'rift-stalker'], ['rift-wyrm'], ['rift-wyrm', 'rift-shardling'], ['rift-shardling', 'rift-shardling', 'rift-stalker']] },
      { band: [0.3, 0.7], packs: [['shard-golem', 'rift-shardling'], ['voidcaller', 'rift-stalker'], ['rift-wyrm', 'rift-wyrm'], ['rift-stalker', 'rift-stalker', 'rift-shardling'], ['voidcaller', 'shard-golem']] },
      { band: [0.6, 1], packs: [['shard-golem', 'rift-stalker'], ['voidcaller', 'voidcaller', 'rift-stalker'], ['rift-wyrm', 'rift-stalker', 'rift-shardling'], ['shard-golem', 'shard-golem']] },
    ],
    wildCount: 54,
  },
);
