import { after, is, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * Gloamhollow (44-48), Act IV: the black fen north of the Shattered Vale, where the Tear's grief runs off
 * into the peat. Marsh-lights lure travelers off the causeways, bog-wights rise from the cuttings and the
 * Host's border riders ride with their torches hooded. Lastlight, a village of lamp-keepers, keeps the
 * causeway lit to the Gloam Gate in the north: the second of the Three Gates, the Host's for thirty years,
 * where the Pale Herald keeps Elyra in the cells under the gatehouse (STORY_BIBLE.md §3).
 *
 * What changes: the fen is in gloom and the Gate shows a violet window until the Gatewarden falls; then
 * Lastlight's lamps hang on the Gate's own hooks and the road north lies open (after the third Gate).
 * Nyx, Elyra and Wren sit by Lastlight's fire from the rescue on.
 */
/** The Gate in the Host's hands. */
const HELD = until('the-gatewarden');

export const GLOAMHOLLOW = wildRegion(
  {
    id: 'gloamhollow',
    name: 'Gloamhollow',
    subtitle: 'The second Gate',
    theme: 'gloam',
    levels: [44, 48],
    at: [48, -10],
    dark: true,
    safe: false,
    music: 'gloamhollow',
    blurb: 'A black fen at the edge of the living lands, lit only by marsh-lights and Lastlight’s lamps, and the Gloam Gate at its end.',
    states: [{ id: 'gate-held', when: HELD, gloom: true }],
  },
  {
    w: 160,
    h: 104,
    seed: 64409,
    levels: [44, 48],
    from: [0.5, 0.95],
    forest: 0.34,
    scatter: { trees: 1.8, bushes: 1.6, rocks: 0.8, flowers: 1 },
    water: { kind: 'lakes', amount: 0.55 },
    hubs: [{ at: [0.55, 0.76], plan: 'boardwalk', npcs: ['lamp-keeper-brin', 'widow-marrow', 'tinker-gale'], houses: 5 }],
    exits: [
      { side: 's', at: 0.55, to: 'shattered-vale', label: 'South road to the Shattered Vale' },
      { side: 'e', at: 0.45, to: 'bonefields', label: 'East along the gate line to the Bonefields', minLevel: 46, needs: 'the-gloam-gate' },
      // through the Gate into Vaelmoor, once all three Gates are taken (Act V)
      { side: 'n', at: 0.5, to: 'weeping-woods', label: 'North through the Gloam Gate into Vaelmoor', minLevel: 48, needs: 'the-third-gate' },
    ],
    pois: [
      // the second Gate: its garrison goes down to the cells when the hero comes up the causeway
      { at: [0.5, 0.12], r: 13, kind: 'ruin', level: 48, packs: [['border-reaver', 'border-reaver', 'hollow-sentinel'], ['bog-wight', 'bog-wight', 'hollow-sentinel'], ['mire-horror', 'border-reaver']], spot: { id: 'the-gloam-gate', name: 'The Gloam Gate' }, landmark: { style: 'keep', w: 9, h: 5, name: 'The Gloam Gate' }, chest: 'epic', when: until('gloam-the-gate') },
      { at: [0.22, 0.4], r: 11, kind: 'den', level: 46, packs: [['mire-horror', 'gloam-lurker'], ['gloam-lurker', 'gloam-lurker', 'marsh-light']], elite: true, rare: 'the-drowned-mother', spot: { id: 'the-black-pool', name: 'The Black Pool' }, chest: 'rare' },
      { at: [0.78, 0.42], r: 10, kind: 'camp', level: 46, packs: [['border-reaver', 'border-reaver', 'bog-wight'], ['hollow-sentinel', 'border-reaver']], rare: 'sir-morrow', spot: { id: 'reaver-camp', name: 'The Reavers’ Camp' } },
      { at: [0.3, 0.72], r: 10, kind: 'grove', level: 45, packs: [['marsh-light', 'marsh-light', 'marsh-light'], ['gloam-lurker', 'marsh-light', 'marsh-light']], spot: { id: 'will-o-glen', name: 'Wisp Glen' } },
      { at: [0.68, 0.64], r: 9, kind: 'ruin', level: 45, packs: [['bog-wight', 'bog-wight'], ['bog-wight', 'marsh-light', 'marsh-light']], spot: { id: 'peat-cuttings', name: 'The Peat Cuttings' }, chest: 'common' },
    ],
    wild: [
      { band: [0, 0.4], packs: [['marsh-light', 'marsh-light', 'gloam-lurker'], ['bog-wight', 'bog-wight'], ['gloam-lurker', 'gloam-lurker'], ['bog-wight', 'marsh-light', 'marsh-light']] },
      { band: [0.35, 0.7], packs: [['mire-horror', 'marsh-light'], ['border-reaver', 'border-reaver'], ['bog-wight', 'bog-wight', 'gloam-lurker'], ['hollow-sentinel', 'bog-wight']] },
      { band: [0.65, 1], packs: [['border-reaver', 'border-reaver', 'hollow-sentinel'], ['mire-horror', 'bog-wight', 'bog-wight'], ['hollow-sentinel', 'hollow-sentinel'], ['border-reaver', 'gloam-lurker', 'marsh-light']] },
    ],
    wildCount: 54,
    story: [
      // the Gatewarden in the gateway, until he falls
      { near: 'the-gloam-gate', dy: -5, marker: { kind: 'pack', enemies: ['the-gatewarden'], level: 48, rare: true }, when: HELD },
      // the cell stair under the gatehouse, the drain out of it, and the first lamp on the causeway
      { near: 'the-gloam-gate', dy: 7, marker: { kind: 'place', id: 'gate-cells' } },
      { near: 'the-gloam-gate', dx: 0, dy: -2, marker: { kind: 'place', id: 'gate-n' } },
      { near: 'the-gloam-gate', dx: -10, dy: 6, marker: { kind: 'place', id: 'gate-w' } },
      { near: 'the-gloam-gate', dx: 10, dy: 6, marker: { kind: 'place', id: 'gate-e' } },
      { near: 'the-gloam-gate', dx: 3, dy: 24, marker: { kind: 'place', id: 'gate-causeway' } },
      // held: grieflight in the gatehouse window, the Host's banners
      { near: 'the-gloam-gate', dx: 0, dy: -4, marker: { kind: 'wisp', color: '#a87aff', size: 2 }, when: HELD },
      { near: 'the-gloam-gate', dx: -4, dy: 3, marker: { kind: 'prop', prop: 'skull-banner' }, when: HELD },
      { near: 'the-gloam-gate', dx: 4, dy: 3, marker: { kind: 'prop', prop: 'skull-banner' }, when: HELD },
      // taken: Lastlight's lamps on the Gate's own hooks, all the way up the causeway
      ...[-4, 4].map((dx) => ({ near: 'the-gloam-gate', dx, dy: 3, marker: { kind: 'prop' as const, prop: 'lantern' }, when: after('the-gatewarden') })),
      ...[8, 13, 18].map((dy, i) => ({ near: 'the-gloam-gate', dx: i % 2 ? 2 : -2, dy, marker: { kind: 'prop' as const, prop: 'iron-torch' }, when: after('gloam-the-unlit-mile') })),
      { near: 'the-gloam-gate', dx: 0, dy: 4, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('the-gatewarden') },
      // Lastlight, the coalition's door into Vaelmoor: Nyx from the day she comes; Elyra and Wren by the fire after the cells
      { near: 'hub', dx: 5, dy: 3, marker: { kind: 'npc', npc: 'nyx-lastlight' }, when: is('gloam-the-lamp-road', 'done') },
      { near: 'hub', dx: -1, dy: 3, marker: { kind: 'npc', npc: 'elyra-lastlight' }, when: is('gloam-out-of-the-cells', 'done') },
      { near: 'hub', dx: 1, dy: 4, marker: { kind: 'npc', npc: 'wren' }, when: after('gloam-out-of-the-cells') },
      { near: 'hub', dx: 0, dy: 2, marker: { kind: 'prop', prop: 'campfire' }, when: after('gloam-out-of-the-cells') },
    ],
  },
);
