import { wildRegion } from '../zonegen';

/**
 * The Riftscar Wastes (53-58): north of the Blightwood, where the Rift first tore the world open in the
 * old war. Glass plains, floating stones, things half come through the Veil. The Pale Herald, Vaelor's
 * voice, feeds the Rift from the Spire of the Rift at the wastes' heart and keeps the Sigil of the Veil
 * there. Veilwatch, a mages' bastion, keeps its wards up in the south-east.
 */
export const RIFTSCAR = wildRegion(
  {
    id: 'riftscar',
    name: 'The Riftscar Wastes',
    subtitle: 'Where the Veil is torn',
    theme: 'rift',
    levels: [53, 58],
    at: [30, -34],
    dark: false,
    safe: false,
    music: 'cave',
    blurb: 'Glass plains under a torn sky, where the Pale Herald feeds the Rift from his spire.',
  },
  {
    w: 160,
    h: 104,
    seed: 15529,
    levels: [53, 58],
    from: [0.85, 0.85],
    forest: 0.26,
    scatter: { trees: 1, bushes: 0.6, rocks: 2, flowers: 1 },
    water: { kind: 'lakes', amount: 0.3 },
    hubs: [{ at: [0.78, 0.8], npcs: ['archmage-orrin', 'steward-pell', 'arcanist-lyra'], houses: 5 }],
    exits: [
      { side: 's', at: 0.6, to: 'blightwood', label: 'South track to the Blightwood' },
      { side: 'e', at: 0.62, to: 'weeping-woods', label: 'East track to the Weeping Woods' },
      { side: 'e', at: 0.25, to: 'gloamhollow', label: 'East road to Gloamhollow', minLevel: 53 },
    ],
    pois: [
      // the Herald's spire
      { at: [0.26, 0.2], r: 12, kind: 'cave', level: 57, packs: [['pale-acolyte', 'pale-acolyte', 'veil-weaver'], ['rift-horror', 'void-stalker'], ['shard-golem', 'pale-acolyte', 'pale-acolyte']], entrance: { to: 'spire-of-the-rift', label: 'The Spire of the Rift', minLevel: 55 }, spot: { id: 'spire-foot', name: 'The Spire’s Foot' }, landmark: { style: 'tower', w: 5, h: 6, name: 'The Spire of the Rift' } },
      { at: [0.5, 0.42], r: 11, kind: 'ruin', level: 56, packs: [['rift-horror', 'tear-wraith', 'tear-wraith'], ['veil-weaver', 'void-stalker', 'void-stalker']], elite: true, rare: 'the-unmade', spot: { id: 'the-first-tear', name: 'The First Tear' }, chest: 'rare' },
      { at: [0.2, 0.62], r: 10, kind: 'camp', level: 55, packs: [['pale-acolyte', 'pale-acolyte', 'pale-acolyte'], ['veil-weaver', 'pale-acolyte']], spot: { id: 'heralds-camp', name: 'The Herald’s Pilgrims' } },
      { at: [0.72, 0.3], r: 10, kind: 'den', level: 55, packs: [['void-stalker', 'void-stalker', 'void-stalker'], ['tear-wraith', 'tear-wraith', 'void-stalker']], spot: { id: 'glass-flats', name: 'The Glass Flats' }, chest: 'common' },
      { at: [0.5, 0.82], r: 9, kind: 'ruin', level: 54, packs: [['shard-golem', 'tear-wraith'], ['tear-wraith', 'tear-wraith', 'tear-wraith']], spot: { id: 'fallen-ward', name: 'The Fallen Ward' }, landmark: { style: 'tower', w: 4, h: 4, name: 'The Fallen Ward' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['void-stalker', 'void-stalker'], ['tear-wraith', 'tear-wraith', 'tear-wraith'], ['shard-golem', 'tear-wraith'], ['pale-acolyte', 'pale-acolyte', 'void-stalker']] },
      { band: [0.35, 0.7], packs: [['rift-horror', 'void-stalker'], ['veil-weaver', 'tear-wraith', 'tear-wraith'], ['pale-acolyte', 'pale-acolyte', 'veil-weaver'], ['shard-golem', 'void-stalker', 'void-stalker']] },
      { band: [0.65, 1], packs: [['rift-horror', 'veil-weaver'], ['shard-golem', 'shard-golem', 'tear-wraith'], ['pale-acolyte', 'pale-acolyte', 'rift-horror'], ['void-stalker', 'void-stalker', 'veil-weaver']] },
    ],
    wildCount: 54,
  },
);
