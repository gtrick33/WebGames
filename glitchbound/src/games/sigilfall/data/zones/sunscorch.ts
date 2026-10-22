import { wildRegion } from '../zonegen';

/**
 * The Sunscorch Expanse (levels 30-36): sand to the horizon east of Ironpeak, red mesas, palms and
 * cacti. The Oasis of Ras keeps its wells in the west. A thousand years ago the Sun King was buried
 * out here with the Sigil of the Sun, and now the Hollow Legion is digging for his tomb: dead miners
 * at the Hollow Dig east of the oasis, dune raiders bought with Hollow gold to guide them from their
 * camp at the Raiders' Rest, and the Sun King's own court walking out of the sand as they dig. The
 * Fallen Obelisk tells the way to the Sunken Gate, far in the east; the old royal Necropolis lies in
 * the south-east, the Dune Tyrant's hollow in the south-west, and Zahra's wrecked sand-ship north of
 * the oasis.
 */
export const SUNSCORCH = wildRegion(
  {
    id: 'sunscorch',
    name: 'The Sunscorch Expanse',
    subtitle: 'The Sun King’s sands',
    theme: 'desert',
    levels: [30, 36],
    at: [100, 48],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Sand to the horizon, raiders and scorpions, and the sunken tomb where the Sun King keeps his sigil.',
  },
  {
    w: 170,
    h: 110,
    seed: 33187,
    levels: [30, 36],
    from: [0.04, 0.5],
    forest: 0.22,
    scatter: { trees: 0.8, bushes: 0.6, rocks: 1.8, flowers: 0.5 },
    water: { kind: 'lakes', amount: 0.15 },
    sand: 'all',
    hubs: [{ at: [0.28, 0.5], npcs: ['oasis-keeper-sefu', 'merchant-zahra', 'sandscribe-ibbi', 'old-kasim'], houses: 5 }],
    exits: [
      { side: 'w', at: 0.5, to: 'ironpeak', label: 'West road to Ironpeak' },
      { side: 'n', at: 0.6, to: 'sablewind', label: 'North road to Sablewind Canyon', minLevel: 36 },
      { side: 's', at: 0.55, to: 'vinecoil', label: 'South road to Vinecoil Jungle', minLevel: 38 },
    ],
    pois: [
      // the Sun King's door, dug open by the Legion; his court spills out of it
      {
        at: [0.78, 0.55],
        r: 11,
        kind: 'cave',
        level: 35,
        packs: [
          ['sun-mummy', 'tomb-scarab', 'tomb-scarab'],
          ['sun-mummy', 'sun-mummy'],
          ['legion-bonecaller', 'legion-miner', 'legion-miner'],
        ],
        entrance: { to: 'tomb-of-the-sun-king', label: 'The Tomb of the Sun King', minLevel: 33 },
        spot: { id: 'sunken-gate', name: 'The Sunken Gate' },
      },
      // the Legion's dead miners digging for the tomb
      {
        at: [0.6, 0.42],
        r: 11,
        kind: 'camp',
        level: 33,
        packs: [
          ['legion-miner', 'legion-miner', 'legion-bonecaller'],
          ['bone-golem', 'legion-miner'],
          ['legion-miner', 'legion-miner', 'legion-miner'],
        ],
        elite: true,
        chest: 'common',
        spot: { id: 'hollow-dig', name: 'The Hollow Dig' },
      },
      // Khamsin's raiders, paid in Hollow gold
      {
        at: [0.5, 0.2],
        r: 11,
        kind: 'camp',
        level: 33,
        packs: [
          ['dune-raider', 'dune-raider', 'dune-javelineer'],
          ['dune-javelineer', 'dune-javelineer'],
          ['dune-raider', 'dune-raider', 'sand-scorpion'],
        ],
        elite: true,
        rare: 'khamsin',
        chest: 'common',
        spot: { id: 'raider-camp', name: 'The Raiders’ Rest' },
      },
      { at: [0.18, 0.82], r: 10, kind: 'den', packs: [['sand-scorpion', 'sand-scorpion'], ['sand-scorpion', 'sand-scorpion', 'sand-scorpion'], ['sand-scorpion', 'sand-wurm']], rare: 'the-dune-tyrant', spot: { id: 'scorpion-hollow', name: 'Scorpion Hollow' } },
      { at: [0.42, 0.78], r: 9, kind: 'ruin', level: 32, packs: [['sun-mummy', 'tomb-scarab', 'tomb-scarab'], ['dune-raider', 'dune-javelineer']], chest: 'rare', spot: { id: 'fallen-obelisk', name: 'The Fallen Obelisk' } },
      { at: [0.3, 0.16], r: 9, kind: 'wreck', packs: [['sand-wurm', 'sand-wurm'], ['dune-raider', 'dune-javelineer']], spot: { id: 'sand-ship', name: 'The Sand-Ship' } },
      // the old kings' burial ground and its temple
      {
        at: [0.66, 0.84],
        r: 11,
        kind: 'ruin',
        level: 34,
        packs: [
          ['sun-mummy', 'tomb-scarab', 'tomb-scarab'],
          ['sun-mummy', 'sun-mummy'],
          ['tomb-scarab', 'tomb-scarab', 'tomb-scarab', 'tomb-scarab'],
        ],
        chest: 'rare',
        spot: { id: 'necropolis', name: 'The Necropolis of Ras' },
        landmark: { style: 'temple', w: 5, h: 3, name: 'The Temple of the Dawn' },
      },
    ],
    wild: [
      {
        band: [0, 0.4],
        packs: [
          ['dune-raider', 'dune-raider'],
          ['dune-raider', 'dune-javelineer'],
          ['sand-scorpion', 'sand-scorpion'],
          ['sand-wurm'],
          ['dune-raider', 'dune-raider', 'dune-javelineer'],
          ['sand-scorpion', 'sand-scorpion', 'sand-scorpion'],
        ],
      },
      {
        band: [0.35, 0.7],
        packs: [
          ['dune-raider', 'dune-javelineer', 'dune-javelineer'],
          ['sun-mummy', 'tomb-scarab', 'tomb-scarab'],
          ['sand-wurm', 'sand-scorpion'],
          ['legion-miner', 'legion-miner', 'legion-bonecaller'],
          ['tomb-scarab', 'tomb-scarab', 'tomb-scarab'],
          ['sand-scorpion', 'sand-scorpion'],
        ],
      },
      {
        band: [0.65, 1],
        packs: [
          ['sun-mummy', 'tomb-scarab', 'tomb-scarab'],
          ['sun-mummy', 'sun-mummy'],
          ['sand-wurm', 'sand-wurm'],
          ['legion-miner', 'bone-golem'],
          ['tomb-scarab', 'tomb-scarab', 'tomb-scarab', 'tomb-scarab'],
          ['dune-raider', 'dune-raider', 'dune-javelineer'],
        ],
      },
    ],
    wildCount: 54,
  },
);
