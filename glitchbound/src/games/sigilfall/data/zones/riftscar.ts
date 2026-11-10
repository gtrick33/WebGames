import { after, is, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * The Riftscar Wastes (44-48), Act IV (STORY_BIBLE.md v3): the torn dusk-land between Aster and Vaelmoor, north of
 * the Shattered Vale, where the Tear first tore the world open in the old war. Glass plains under a violet sky,
 * floating stones, things half come through the Veil, and the Pale Herald's spire in the far north-west, from
 * which he feeds the Tear. Lastlight, a walled village of lamp-keepers, keeps the road lit through the glass to the
 * Gloam Gate in the north: the second of the Three Gates, the Host's for thirty years, where the Herald keeps Elyra
 * in the cells under the gatehouse, and where Ser Edric held the gate alone three hundred years ago.
 *
 * What changes: the wastes are in gloom and the Gate shows a violet window until the Gatewarden falls; then
 * Lastlight's lamps hang on the Gate's own hooks and the road north into Vaelmoor lies open. Nyx, Elyra and Wren
 * sit by Lastlight's fire from the rescue on. (The Gloam's story was played in Gloamhollow before; its quests keep
 * their ids, data/zones/gloamhollow-quests.ts. The wastes' own old chain, the Herald's end, stays retired.)
 */
/** The Gate in the Host's hands. */
const HELD = until('the-gatewarden');

export const RIFTSCAR = wildRegion(
  {
    id: 'riftscar',
    name: 'The Riftscar Wastes',
    subtitle: 'The second Gate',
    theme: 'rift',
    levels: [44, 48],
    at: [48, -10],
    dark: false,
    safe: false,
    music: 'riftscar',
    states: [{ id: 'gate-held', when: HELD, gloom: true }],
    blurb: 'Glass plains under a torn violet sky, lit only by Lastlight’s lamps, with the Pale Herald’s spire in the west and the Gloam Gate at the road’s end.',
  },
  {
    w: 160,
    h: 104,
    seed: 15529,
    levels: [44, 48],
    from: [0.8, 0.92],
    forest: 0.26,
    scatter: { trees: 1, bushes: 0.6, rocks: 2, flowers: 1 },
    water: { kind: 'lakes', amount: 0.3 },
    hubs: [{ at: [0.76, 0.75], plan: 'citadel', npcs: ['lamp-keeper-brin', 'widow-marrow', 'tinker-gale'], houses: 5 }],
    exits: [
      { side: 's', at: 0.75, to: 'shattered-vale', label: 'South causeway to Shardwatch and the Shattered Vale' },
      // through the Gate into Vaelmoor, once it is taken (Act V)
      { side: 'n', at: 0.6, to: 'weeping-woods', label: 'North through the Gloam Gate into Vaelmoor', minLevel: 48, needs: 'the-gloam-gate' },
      { side: 'e', at: 0.3, to: 'highwall', label: 'East along the gate line to Highwall March', needs: 'the-gloam-gate' },
    ],
    pois: [
      // the second Gate: the Herald's acolytes keep it, and go down to the cells when the hero comes up the road
      // (in front of the great gate, data/greatworks.ts: whatever stands behind it can't be seen)
      { at: [0.6, 0.3], r: 13, kind: 'ruin', level: 48, packs: [['pale-acolyte', 'pale-acolyte', 'hollow-sentinel'], ['tear-wraith', 'tear-wraith', 'hollow-sentinel'], ['veil-weaver', 'border-reaver']], spot: { id: 'the-gloam-gate', name: 'The Gloam Gate' }, landmark: { style: 'keep', w: 9, h: 5, name: 'The Gloam Gate' }, chest: 'epic', when: until('gloam-the-gate') },
      // the Herald's spire, from which he feeds the Tear (its dungeon is a Riftstone run, for later)
      { at: [0.26, 0.2], r: 12, kind: 'cave', level: 48, packs: [['pale-acolyte', 'pale-acolyte', 'veil-weaver'], ['rift-horror', 'void-stalker'], ['shard-golem', 'pale-acolyte', 'pale-acolyte']], entrance: { to: 'spire-of-the-rift', label: 'The Spire of the Tear', minLevel: 55 }, spot: { id: 'spire-foot', name: 'The Spire’s Foot' } },
      { at: [0.44, 0.52], r: 11, kind: 'ruin', level: 47, packs: [['rift-horror', 'tear-wraith', 'tear-wraith'], ['veil-weaver', 'void-stalker', 'void-stalker'], ['rift-horror', 'rift-horror']], elite: true, rare: 'the-unmade', spot: { id: 'the-first-tear', name: 'The First Tear' }, chest: 'rare' },
      // the wisps that lean on Lastlight's lamps until they go out
      { at: [0.62, 0.55], r: 10, kind: 'grove', level: 45, packs: [['marsh-light', 'marsh-light', 'marsh-light'], ['tear-wraith', 'marsh-light', 'marsh-light']], spot: { id: 'will-o-glen', name: 'Wisp Glen' } },
      { at: [0.22, 0.86], r: 11, kind: 'den', level: 46, packs: [['gloam-lurker', 'void-stalker'], ['gloam-lurker', 'gloam-lurker', 'marsh-light']], elite: true, rare: 'the-drowned-mother', spot: { id: 'the-black-pool', name: 'The Black Pool' }, chest: 'rare' },
      { at: [0.2, 0.6], r: 10, kind: 'camp', level: 46, packs: [['pale-acolyte', 'pale-acolyte', 'pale-acolyte'], ['veil-weaver', 'pale-acolyte'], ['border-reaver', 'pale-acolyte', 'pale-acolyte']], spot: { id: 'heralds-camp', name: 'The Herald’s Pilgrims' } },
      { at: [0.86, 0.42], r: 10, kind: 'den', level: 45, packs: [['void-stalker', 'void-stalker', 'void-stalker'], ['tear-wraith', 'tear-wraith', 'void-stalker']], spot: { id: 'glass-flats', name: 'The Glass Flats' }, chest: 'common' },
      { at: [0.5, 0.82], r: 9, kind: 'ruin', level: 44, packs: [['shard-golem', 'tear-wraith'], ['tear-wraith', 'tear-wraith', 'tear-wraith'], ['shard-golem', 'shard-golem']], spot: { id: 'fallen-ward', name: 'The Fallen Ward' }, landmark: { style: 'tower', w: 4, h: 4, name: 'The Fallen Ward' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['void-stalker', 'void-stalker'], ['tear-wraith', 'tear-wraith'], ['marsh-light', 'marsh-light', 'tear-wraith'], ['shard-golem', 'tear-wraith'], ['pale-acolyte', 'pale-acolyte', 'void-stalker']] },
      { band: [0.35, 0.7], packs: [['rift-horror', 'void-stalker'], ['veil-weaver', 'tear-wraith', 'tear-wraith'], ['pale-acolyte', 'pale-acolyte', 'veil-weaver'], ['shard-golem', 'void-stalker', 'void-stalker']] },
      { band: [0.65, 1], packs: [['rift-horror', 'veil-weaver'], ['shard-golem', 'shard-golem', 'tear-wraith'], ['pale-acolyte', 'pale-acolyte', 'rift-horror'], ['void-stalker', 'void-stalker', 'veil-weaver']] },
    ],
    wildCount: 54,
    story: [
      // the Gatewarden in the gateway, until he falls
      { near: 'the-gloam-gate', dy: -5, marker: { kind: 'pack', enemies: ['the-gatewarden'], level: 48, rare: true }, when: HELD },
      // the cell stair under the gatehouse, the drain out of it, and the first lamp on the road
      { near: 'the-gloam-gate', dy: 7, marker: { kind: 'place', id: 'gate-cells' } },
      { near: 'the-gloam-gate', dx: 0, dy: -2, marker: { kind: 'place', id: 'gate-n' } },
      { near: 'the-gloam-gate', dx: -10, dy: 6, marker: { kind: 'place', id: 'gate-w' } },
      { near: 'the-gloam-gate', dx: 10, dy: 6, marker: { kind: 'place', id: 'gate-e' } },
      { near: 'the-gloam-gate', dx: 3, dy: 24, marker: { kind: 'place', id: 'gate-causeway' } },
      // held: grieflight in the gatehouse window, the Host's banners
      { near: 'the-gloam-gate', dx: 0, dy: -4, marker: { kind: 'wisp', color: '#a87aff', size: 2 }, when: HELD },
      { near: 'the-gloam-gate', dx: -4, dy: 3, marker: { kind: 'prop', prop: 'skull-banner' }, when: HELD },
      { near: 'the-gloam-gate', dx: 4, dy: 3, marker: { kind: 'prop', prop: 'skull-banner' }, when: HELD },
      // taken: Lastlight's lamps on the Gate's own hooks, all the way up the road
      ...[-4, 4].map((dx) => ({ near: 'the-gloam-gate', dx, dy: 3, marker: { kind: 'prop' as const, prop: 'lantern' }, when: after('the-gatewarden') })),
      ...[8, 13, 18].map((dy, i) => ({ near: 'the-gloam-gate', dx: i % 2 ? 2 : -2, dy, marker: { kind: 'prop' as const, prop: 'iron-torch' }, when: after('gloam-the-unlit-mile') })),
      { near: 'the-gloam-gate', dx: 0, dy: 4, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('the-gatewarden') },
      // the Tear's light over the Herald's spire and the First Tear; the Fallen Ward lit again once the Gate is ours
      { near: 'spire-foot', dx: 0, dy: -4, marker: { kind: 'wisp', color: '#c58cff', size: 3 } },
      { near: 'the-first-tear', dx: 0, dy: 0, marker: { kind: 'wisp', color: '#b58aff', size: 2 } },
      { near: 'fallen-ward', dx: -2, dy: 3, marker: { kind: 'prop', prop: 'iron-torch' }, when: after('the-gloam-gate') },
      { near: 'fallen-ward', dx: 2, dy: 3, marker: { kind: 'prop', prop: 'iron-torch' }, when: after('the-gloam-gate') },
      // Lastlight, the coalition's door into Vaelmoor: Nyx from the day she comes; Elyra and Wren by the fire after the cells
      { near: 'hub', dx: 5, dy: 3, marker: { kind: 'npc', npc: 'nyx-lastlight' }, when: is('gloam-the-lamp-road', 'done') },
      { near: 'hub', dx: -1, dy: 3, marker: { kind: 'npc', npc: 'elyra-lastlight' }, when: is('gloam-out-of-the-cells', 'done') },
      { near: 'hub', dx: 1, dy: 4, marker: { kind: 'npc', npc: 'wren' }, when: after('gloam-out-of-the-cells') },
      { near: 'hub', dx: 0, dy: 2, marker: { kind: 'prop', prop: 'campfire' }, when: after('gloam-out-of-the-cells') },
      { near: 'hub', dx: 0, dy: -5, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('the-gloam-gate') },
    ],
  },
);
