import { wildRegion } from '../zonegen';

/**
 * Gloamhollow (54-59): north of the Weeping Woods, the black fen where the living lands end and the
 * Hollow King's begin. The sun never quite rises over it; marsh-lights lure travelers off the causeways,
 * bog-wights rise from the peat and the King's reavers ride the border. Lastlight, a village of lamp-
 * keepers who keep the road lit, is the last living place before Hollowmere. The Gloam Gate in the
 * north, kept by the Gatewarden, is the King's border.
 */
export const GLOAMHOLLOW = wildRegion(
  {
    id: 'gloamhollow',
    name: 'Gloamhollow',
    subtitle: 'The King’s border',
    theme: 'gloam',
    levels: [54, 59],
    at: [46, -48],
    dark: true,
    safe: false,
    music: 'forest',
    blurb: 'A black fen at the edge of the living lands, lit only by marsh-lights and Lastlight’s lamps.',
  },
  {
    w: 160,
    h: 104,
    seed: 64409,
    levels: [54, 59],
    from: [0.5, 0.95],
    forest: 0.34,
    scatter: { trees: 1.8, bushes: 1.6, rocks: 0.8, flowers: 1 },
    water: { kind: 'lakes', amount: 0.55 },
    hubs: [{ at: [0.55, 0.8], npcs: ['lamp-keeper-ada', 'widow-marrow', 'tinker-gale'], houses: 5 }],
    exits: [
      { side: 's', at: 0.55, to: 'weeping-woods', label: 'South road to the Weeping Woods' },
      { side: 'w', at: 0.4, to: 'riftscar', label: 'West road to the Riftscar Wastes' },
      { side: 'e', at: 0.3, to: 'hollowmere', label: 'East causeway to Hollowmere', minLevel: 55 },
    ],
    pois: [
      // the King's border, and its keeper
      { at: [0.5, 0.12], r: 13, kind: 'ruin', level: 59, packs: [['border-reaver', 'border-reaver', 'hollow-sentinel'], ['bog-wight', 'bog-wight', 'hollow-sentinel'], ['mire-horror', 'border-reaver']], rare: 'the-gatewarden', spot: { id: 'the-gloam-gate', name: 'The Gloam Gate' }, landmark: { style: 'keep', w: 9, h: 5, name: 'The Gloam Gate' }, chest: 'epic' },
      { at: [0.22, 0.4], r: 11, kind: 'den', level: 56, packs: [['mire-horror', 'gloam-lurker'], ['gloam-lurker', 'gloam-lurker', 'marsh-light']], elite: true, rare: 'the-drowned-mother', spot: { id: 'the-black-pool', name: 'The Black Pool' }, chest: 'rare' },
      { at: [0.78, 0.42], r: 10, kind: 'camp', level: 57, packs: [['border-reaver', 'border-reaver', 'bog-wight'], ['hollow-sentinel', 'border-reaver']], spot: { id: 'reaver-camp', name: 'The Reavers’ Camp' } },
      { at: [0.3, 0.72], r: 10, kind: 'grove', level: 55, packs: [['marsh-light', 'marsh-light', 'marsh-light'], ['gloam-lurker', 'marsh-light', 'marsh-light']], spot: { id: 'will-o-glen', name: 'Wisp Glen' } },
      { at: [0.68, 0.64], r: 9, kind: 'ruin', level: 55, packs: [['bog-wight', 'bog-wight'], ['bog-wight', 'marsh-light', 'marsh-light']], spot: { id: 'peat-cuttings', name: 'The Peat Cuttings' }, chest: 'common' },
    ],
    wild: [
      { band: [0, 0.4], packs: [['marsh-light', 'marsh-light', 'gloam-lurker'], ['bog-wight', 'bog-wight'], ['gloam-lurker', 'gloam-lurker'], ['bog-wight', 'marsh-light', 'marsh-light']] },
      { band: [0.35, 0.7], packs: [['mire-horror', 'marsh-light'], ['border-reaver', 'border-reaver'], ['bog-wight', 'bog-wight', 'gloam-lurker'], ['hollow-sentinel', 'bog-wight']] },
      { band: [0.65, 1], packs: [['border-reaver', 'border-reaver', 'hollow-sentinel'], ['mire-horror', 'bog-wight', 'bog-wight'], ['hollow-sentinel', 'hollow-sentinel'], ['border-reaver', 'gloam-lurker', 'marsh-light']] },
    ],
    wildCount: 54,
  },
);
