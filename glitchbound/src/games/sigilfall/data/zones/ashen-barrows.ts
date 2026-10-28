import { after, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * The Ashen Barrows (levels 23-29): grey downs of burial mounds west of Ironpeak, where the barrow
 * kings lie. Lantern Hill keeps its warden-lamps lit on the high ground in the north; Candle Fen's
 * cold lights drift to the east, the Ninefold Barrows and Houndsmound lie south-east, the Sigil-wardens'
 * Broken Chapel south-west, and the Kings' Mound, where Sir Corvane raises the barrow kings, at the far
 * western end of the downs.
 */
export const ASHEN_BARROWS = wildRegion(
  {
    id: 'ashen-barrows',
    name: 'The Ashen Barrows',
    subtitle: 'Where the barrow kings wake',
    theme: 'barrow',
    levels: [23, 29],
    at: [68, 40],
    dark: false,
    safe: false,
    music: 'ashen-barrows',
    blurb: 'Ash-grey downs of burial mounds, wights and banshees, and the death knight who leads them.',
    // the lamps are going out, one a night: a cold gloom until Orren's vigil relights them
    states: [{ id: 'lamps-out', when: until('the-last-lamp'), gloom: true }],
  },
  {
    w: 150,
    h: 104,
    seed: 15881,
    levels: [23, 29],
    from: [0.96, 0.5],
    forest: 0.2,
    scatter: { trees: 1.4, bushes: 0.8, rocks: 1.8, flowers: 2 },
    water: { kind: 'lakes', amount: 0.2 },
    hubs: [{ at: [0.5, 0.25], npcs: ['lamplighter-ivo', 'sister-maud', 'gravedigger-kell'], houses: 5 }],
    story: [
      // the great lamp at the top of the hill, and the roads the dead climb to it
      { near: 'hub', dy: -7, marker: { kind: 'place', id: 'lantern-hill' } },
      { near: 'hub', dy: -15, marker: { kind: 'place', id: 'lantern-n' } },
      { near: 'hub', dx: -12, dy: -6, marker: { kind: 'place', id: 'lantern-w' } },
      { near: 'hub', dx: 12, dy: -6, marker: { kind: 'place', id: 'lantern-e' } },
      // Orren's chapel lamp, the only one still lit; Orren and Cael on the hill until they go to the city
      { near: 'hub', dx: 2, dy: -7, marker: { kind: 'prop', prop: 'lantern' } },
      { near: 'hub', dx: 4, dy: -6, marker: { kind: 'npc', npc: 'brother-orren' }, when: until('sir-corvane') },
      { near: 'hub', dx: -6, dy: 4, marker: { kind: 'npc', npc: 'cael-varrow' }, when: until('sir-corvane') },
      // relit: lamps down the roads, at the mounds and at the chapel ruins
      ...[
        [-5, -3],
        [5, -3],
        [-8, 6],
        [8, 6],
        [0, 10],
      ].map(([dx, dy]) => ({ near: 'hub', dx, dy, marker: { kind: 'prop' as const, prop: 'lantern' }, when: after('the-last-lamp') })),
      { near: 'kings-mound', dx: 4, dy: 2, marker: { kind: 'prop', prop: 'lantern' }, when: after('the-last-lamp') },
      { near: 'broken-chapel', dx: -3, dy: 3, marker: { kind: 'prop', prop: 'lantern' }, when: after('the-last-lamp') },
      // after Corvane: his banner laid on the Kings' Mound, and the Ninefold Watch's flag over the hill
      { near: 'kings-mound', dx: -2, dy: 3, marker: { kind: 'prop', prop: 'flag' }, when: after('sir-corvane') },
      { near: 'hub', dx: 0, dy: -9, marker: { kind: 'prop', prop: 'blue-banner' }, when: after('sir-corvane') },
    ],
    exits: [{ side: 'e', at: 0.5, to: 'ironpeak', label: 'East pass to Ironpeak' },
      { side: 'n', at: 0.5, to: 'grimward', label: 'North road to the Grimward Moors', minLevel: 28 },
      { side: 'w', at: 0.35, to: 'emberwick', label: 'The King’s Road to the Crown City', needs: 'sir-corvane' }],
    pois: [
      {
        at: [0.12, 0.62],
        r: 10,
        kind: 'cave',
        packs: [
          ['wight-knight', 'barrow-wight'],
          ['wight-knight', 'barrow-hound', 'barrow-hound'],
          ['wight-archer', 'wight-archer', 'barrow-wight'],
        ],
        elite: true,
        entrance: { to: 'barrow-of-kings', label: 'The Barrow of Kings', minLevel: 27 },
        spot: { id: 'kings-mound', name: 'The Kings’ Mound' },
      },
      {
        at: [0.34, 0.68],
        r: 11,
        kind: 'ruin',
        packs: [
          ['banshee', 'barrow-wight'],
          ['banshee', 'banshee'],
          ['wight-archer', 'barrow-wight'],
        ],
        rare: 'mother-aldith',
        chest: 'rare',
        spot: { id: 'broken-chapel', name: 'The Broken Chapel' },
      },
      {
        at: [0.62, 0.52],
        r: 10,
        kind: 'ruin',
        packs: [
          ['barrow-wight', 'barrow-wight'],
          ['wight-archer', 'barrow-wight'],
          ['wight-knight', 'barrow-wight'],
        ],
        rare: 'the-headless-lord',
        spot: { id: 'ninefold-barrows', name: 'The Ninefold Barrows' },
      },
      { at: [0.66, 0.84], r: 9, kind: 'den', packs: [['barrow-hound', 'barrow-hound', 'barrow-hound'], ['barrow-hound', 'barrow-hound']], chest: 'common', spot: { id: 'houndsmound', name: 'Houndsmound' } },
      { at: [0.82, 0.26], r: 9, kind: 'grove', packs: [['corpse-candle', 'corpse-candle'], ['corpse-candle', 'corpse-candle', 'corpse-candle']], spot: { id: 'candle-fen', name: 'Candle Fen' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['barrow-hound', 'barrow-hound'], ['barrow-wight', 'barrow-wight'], ['corpse-candle', 'corpse-candle'], ['barrow-wight', 'wight-archer']] },
      { band: [0.3, 0.7], packs: [['wight-knight', 'barrow-wight'], ['banshee', 'barrow-wight', 'barrow-hound'], ['wight-archer', 'barrow-wight', 'barrow-wight'], ['corpse-candle', 'banshee']] },
      { band: [0.6, 1], packs: [['wight-knight', 'wight-archer'], ['banshee', 'banshee', 'barrow-wight'], ['wight-knight', 'barrow-hound', 'barrow-hound'], ['wight-knight', 'corpse-candle']] },
    ],
    wildCount: 52,
  },
);
