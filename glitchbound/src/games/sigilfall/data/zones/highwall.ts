import { wildRegion } from '../zonegen';

/**
 * Highwall March (40-46): the war-torn country before the great fortress-city of Highwall, which
 * guards the road north into the Hollow King's own lands. General Morvain's Hollow Legion has it under
 * siege: trenches and bone catapults in the west, the Breach smashed in the walls north-west, burned
 * villages, trampled fields and the knights' old chapel with its graves dug open. Lord-Commander Varn
 * holds the relief camp in the east, where the road comes in from Sablewind Canyon.
 */
export const HIGHWALL = wildRegion(
  {
    id: 'highwall',
    name: 'Highwall March',
    subtitle: 'The siege of Highwall',
    theme: 'warfront',
    levels: [40, 46],
    at: [78, 4],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Trenches, smoke and the great fortress of Highwall under siege by the Hollow Legion.',
  },
  {
    w: 160,
    h: 104,
    seed: 63301,
    levels: [40, 46],
    from: [0.96, 0.6],
    forest: 0.2,
    scatter: { trees: 1, bushes: 1, rocks: 2, flowers: 0.5 },
    water: { kind: 'river', from: 'n', to: 's' },
    hubs: [{ at: [0.75, 0.65], npcs: ['lord-commander-varn', 'quartermaster-bess', 'chaplain-ottis'], houses: 6 }],
    exits: [
      { side: 'e', at: 0.6, to: 'sablewind', label: 'East road to Sablewind Canyon' },
      { side: 'w', at: 0.5, to: 'shattered-vale', label: 'West road to the Shattered Vale' },
    ],
    pois: [
      // the way into besieged Highwall: the hole the Siege-Breaker smashed in its walls
      { at: [0.35, 0.3], r: 12, kind: 'cave', level: 44, packs: [['death-knight-initiate', 'legion-soldier'], ['legion-crossbowman', 'legion-soldier', 'legion-soldier'], ['bone-catapult', 'legion-ensign', 'legion-soldier']], entrance: { to: 'siege-of-highwall', label: 'The Breach: into besieged Highwall', minLevel: 42 }, spot: { id: 'the-breach', name: 'The Breach' }, landmark: { style: 'keep', w: 10, h: 5, name: 'Highwall' } },
      { at: [0.16, 0.66], r: 11, kind: 'camp', level: 43, packs: [['legion-soldier', 'legion-soldier', 'legion-crossbowman'], ['bone-catapult', 'legion-soldier'], ['legion-ensign', 'legion-soldier', 'legion-soldier']], elite: true, rare: 'captain-hollowbane', spot: { id: 'legion-lines', name: 'The Legion Lines' }, chest: 'rare' },
      { at: [0.42, 0.58], r: 10, kind: 'camp', level: 42, packs: [['bone-catapult', 'legion-crossbowman'], ['bone-catapult', 'legion-soldier', 'legion-soldier']], spot: { id: 'bone-batteries', name: 'The Bone Batteries' }, chest: 'common' },
      { at: [0.56, 0.84], r: 10, kind: 'ruin', level: 41, packs: [['ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm'], ['ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm']], spot: { id: 'burned-village', name: 'Burned Ashby' } },
      { at: [0.62, 0.22], r: 9, kind: 'farm', level: 42, packs: [['legion-crossbowman', 'legion-crossbowman'], ['legion-crossbowman', 'legion-soldier', 'legion-soldier']], spot: { id: 'trampled-fields', name: 'The Trampled Fields' } },
      { at: [0.9, 0.28], r: 10, kind: 'ruin', level: 42, packs: [['death-knight-initiate', 'ghoul-swarm', 'ghoul-swarm'], ['death-knight-initiate', 'legion-ensign']], spot: { id: 'knights-chapel', name: 'The Knights’ Chapel' }, landmark: { style: 'temple', w: 5, h: 4, name: 'The Knights’ Chapel' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['legion-soldier', 'legion-soldier', 'legion-soldier'], ['ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm'], ['legion-crossbowman', 'legion-soldier', 'legion-soldier'], ['grave-hound', 'grave-hound', 'legion-soldier', 'legion-soldier'], ['legion-soldier', 'legion-soldier', 'ghoul-swarm', 'ghoul-swarm'], ['legion-crossbowman', 'legion-crossbowman', 'legion-soldier'], ['bone-catapult', 'legion-soldier', 'legion-soldier'], ['legion-ensign', 'legion-soldier', 'legion-soldier']] },
      { band: [0.35, 0.7], packs: [['legion-soldier', 'legion-soldier', 'legion-crossbowman', 'legion-crossbowman'], ['bone-catapult', 'legion-soldier', 'legion-soldier'], ['death-knight-initiate', 'ghoul-swarm', 'ghoul-swarm', 'ghoul-swarm'], ['legion-ensign', 'legion-soldier', 'legion-soldier', 'legion-crossbowman'], ['legion-crossbowman', 'legion-crossbowman', 'legion-soldier']] },
      { band: [0.65, 1], packs: [['death-knight-initiate', 'legion-soldier', 'legion-soldier'], ['bone-catapult', 'legion-crossbowman', 'legion-soldier', 'legion-soldier'], ['legion-ensign', 'death-knight-initiate', 'legion-soldier'], ['legion-soldier', 'legion-soldier', 'legion-soldier', 'legion-crossbowman']] },
    ],
    wildCount: 56,
  },
);
