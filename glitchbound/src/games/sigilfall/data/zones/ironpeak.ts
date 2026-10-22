import { wildRegion } from '../zonegen';

/**
 * The Ironpeak Highlands (levels 20-26): high passes north of the Amberfield. Kragholt, the dwarves'
 * town, still stands west of the river; the Hollow Legion holds the Deepforge in the mountain to the
 * north-east, digs the iron quarry south-west of town and empties the dwarves' tombs in the Hall of
 * Ancestors for the bones in its bone-steel. Frost rams graze the heights by the south road and
 * raid the frostmalt terraces that Kragholt brews from; griffons nest on the crags to the east.
 */
export const IRONPEAK = wildRegion(
  {
    id: 'ironpeak',
    name: 'The Ironpeak Highlands',
    subtitle: 'Mountains of the dwarves',
    theme: 'mountain',
    levels: [20, 26],
    at: [80, 52],
    dark: false,
    safe: false,
    music: 'cave',
    blurb: 'High passes, frost rams, griffons, and the Legion’s miners at the dwarves’ stolen forge.',
  },
  {
    w: 150,
    h: 110,
    seed: 90211,
    levels: [20, 26],
    from: [0.5, 0.96],
    forest: 0.34,
    scatter: { trees: 1.6, bushes: 0.6, rocks: 3, flowers: 1.6 },
    water: { kind: 'river', from: 'n', to: 's' },
    hubs: [{ at: [0.3, 0.55], npcs: ['thane-borrik', 'hilda-stoutbrew', 'gemcutter-oz', 'brenna'], houses: 6 }],
    exits: [
      { side: 's', at: 0.5, to: 'amberfield', label: 'South road to the Amberfield' },
      { side: 'w', at: 0.55, to: 'ashen-barrows', label: 'West pass to the Ashen Barrows', minLevel: 22 },
    ],
    pois: [
      {
        at: [0.72, 0.2],
        r: 11,
        kind: 'cave',
        packs: [
          ['legion-miner', 'legion-miner', 'legion-slagthrower'],
          ['bone-golem', 'legion-miner'],
          ['legion-bonecaller', 'legion-miner'],
        ],
        elite: true,
        entrance: { to: 'deepforge-halls', label: 'The Deepforge Halls', minLevel: 24 },
        spot: { id: 'deepforge-gate', name: 'The Deepforge Gate' },
      },
      { at: [0.8, 0.66], r: 10, kind: 'nest', packs: [['griffon', 'griffon'], ['griffon', 'griffon', 'griffon'], ['griffon', 'griffon']], rare: 'stormwing', spot: { id: 'griffon-crags', name: 'Griffon Crags' } },
      { at: [0.44, 0.84], r: 10, kind: 'den', packs: [['frost-ram', 'frost-ram'], ['frost-ram', 'frost-ram', 'frost-ram'], ['frost-ram', 'frost-ram']], rare: 'old-horn', spot: { id: 'ram-heights', name: 'Ram Heights' } },
      { at: [0.62, 0.8], r: 9, kind: 'farm', packs: [['frost-ram', 'frost-ram'], ['frost-ram', 'frost-ram']], spot: { id: 'frostmalt-terraces', name: 'The Frostmalt Terraces' } },
      { at: [0.5, 0.12], r: 9, kind: 'ruin', packs: [['legion-miner', 'bone-golem'], ['legion-slagthrower', 'legion-slagthrower', 'legion-miner']], chest: 'rare', spot: { id: 'old-watch', name: 'The Old Dwarf Watch' } },
      {
        at: [0.2, 0.82],
        r: 11,
        kind: 'camp',
        packs: [
          ['legion-miner', 'legion-miner', 'legion-miner'],
          ['bone-golem', 'legion-slagthrower'],
          ['legion-bonecaller', 'legion-miner'],
        ],
        elite: true,
        chest: 'common',
        spot: { id: 'hollow-quarry', name: 'The Hollow Quarry' },
      },
      {
        at: [0.16, 0.3],
        r: 10,
        kind: 'ruin',
        level: 23,
        packs: [
          ['legion-bonecaller', 'legion-miner'],
          ['legion-bonecaller', 'legion-slagthrower'],
          ['bone-golem', 'legion-bonecaller'],
        ],
        spot: { id: 'ancestors-hall', name: 'The Hall of Ancestors' },
      },
    ],
    wild: [
      { band: [0, 0.4], packs: [['frost-ram', 'frost-ram'], ['frost-ram', 'frost-ram', 'frost-ram'], ['legion-miner', 'legion-miner'], ['griffon', 'griffon'], ['legion-miner', 'legion-slagthrower']] },
      { band: [0.3, 0.7], packs: [['legion-miner', 'legion-miner', 'legion-slagthrower'], ['bone-golem', 'legion-miner'], ['legion-bonecaller', 'legion-miner'], ['griffon', 'frost-ram'], ['griffon', 'griffon'], ['frost-ram', 'frost-ram']] },
      { band: [0.6, 1], packs: [['bone-golem', 'legion-slagthrower'], ['legion-miner', 'legion-miner', 'legion-bonecaller'], ['legion-slagthrower', 'legion-slagthrower', 'bone-golem'], ['griffon', 'griffon']] },
    ],
    wildCount: 50,
  },
);
