import { wildRegion } from '../zonegen';

/**
 * The Pale Reach (57-60): the Hollow King's own land, a frozen waste of grey snow under a violet sky,
 * where nothing living grows and the dead stand in ranks waiting for their master's word. Commander
 * Aldric's vanguard holds Dawn's Rest, a ruined waystation in the south. Duskspire, Vaelor's citadel,
 * rises in the north; its last door opens only for one who carries all seven sigils.
 */
export const PALE_REACH = wildRegion(
  {
    id: 'pale-reach',
    name: 'The Pale Reach',
    subtitle: 'The road to Duskspire',
    theme: 'pale',
    levels: [57, 60],
    at: [56, -66],
    dark: false,
    safe: false,
    music: 'crypt',
    blurb: 'The Hollow King’s frozen land, where the dead stand in ranks and Duskspire rises in the north.',
  },
  {
    w: 160,
    h: 110,
    seed: 10601,
    levels: [57, 60],
    from: [0.5, 0.95],
    forest: 0.26,
    scatter: { trees: 1, bushes: 0.6, rocks: 2, flowers: 0.4 },
    water: { kind: 'lakes', amount: 0.25 },
    hubs: [{ at: [0.5, 0.84], npcs: ['commander-aldric', 'brother-cael', 'quartermaster-holt', 'outrider-maeve'], houses: 4 }],
    exits: [{ side: 's', at: 0.5, to: 'hollowmere', label: 'South road to Hollowmere' }],
    pois: [
      // the King's citadel: the way in needs all seven sigils (sim/world.ts exitLock)
      { at: [0.5, 0.12], r: 13, kind: 'cave', level: 59, packs: [['pale-knight', 'hollow-legionnaire', 'soul-reaver'], ['hollow-legionnaire', 'hollow-legionnaire', 'hollow-legionnaire'], ['pale-knight', 'frost-wraith', 'frost-wraith']], entrance: { to: 'duskspire', label: 'The Duskspire Gate', minLevel: 58 }, spot: { id: 'duskspire-gate', name: 'The Duskspire Gate' }, landmark: { style: 'keep', w: 12, h: 6, name: 'Duskspire' } },
      // the Host in its ranks, under the Pale Standard
      { at: [0.2, 0.36], r: 12, kind: 'camp', level: 58, packs: [['hollow-legionnaire', 'hollow-legionnaire', 'soul-reaver'], ['pale-knight', 'hollow-legionnaire'], ['hollow-legionnaire', 'hollow-legionnaire', 'hollow-legionnaire']], elite: true, rare: 'the-pale-standard', spot: { id: 'the-kings-host', name: 'The King’s Host' }, chest: 'rare' },
      { at: [0.8, 0.34], r: 11, kind: 'nest', level: 58, packs: [['bone-drake', 'frost-wraith'], ['bone-drake', 'pale-hound', 'pale-hound'], ['bone-drake', 'bone-drake']], spot: { id: 'drake-graves', name: 'The Drake Graves' } },
      { at: [0.3, 0.64], r: 10, kind: 'ruin', level: 58, packs: [['frost-wraith', 'frost-wraith', 'soul-reaver'], ['hollow-legionnaire', 'frost-wraith'], ['frost-wraith', 'frost-wraith', 'frost-wraith']], spot: { id: 'frozen-village', name: 'Old Wintersend' }, landmark: { style: 'hall', w: 6, h: 4, name: 'Wintersend Hall' }, chest: 'common' },
      { at: [0.72, 0.66], r: 10, kind: 'den', level: 57, packs: [['pale-hound', 'pale-hound', 'pale-hound'], ['pale-hound', 'pale-hound', 'frost-wraith']], rare: 'gravejaw', spot: { id: 'hound-kennels', name: 'The King’s Kennels' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['pale-hound', 'pale-hound', 'pale-hound'], ['frost-wraith', 'frost-wraith'], ['hollow-legionnaire', 'hollow-legionnaire'], ['soul-reaver', 'pale-hound', 'pale-hound'], ['hollow-legionnaire', 'frost-wraith']] },
      { band: [0.35, 0.7], packs: [['pale-knight', 'hollow-legionnaire'], ['frost-wraith', 'frost-wraith', 'soul-reaver'], ['hollow-legionnaire', 'hollow-legionnaire', 'hollow-legionnaire'], ['bone-drake', 'pale-hound'], ['soul-reaver', 'hollow-legionnaire', 'hollow-legionnaire']] },
      { band: [0.65, 1], packs: [['pale-knight', 'pale-knight'], ['bone-drake', 'frost-wraith', 'frost-wraith'], ['soul-reaver', 'soul-reaver', 'hollow-legionnaire'], ['pale-knight', 'hollow-legionnaire', 'hollow-legionnaire'], ['bone-drake', 'soul-reaver']] },
    ],
    wildCount: 56,
  },
);
