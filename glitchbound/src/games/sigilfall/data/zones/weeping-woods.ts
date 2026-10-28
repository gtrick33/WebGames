import { after, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * The Weeping Woods (48-51), Act V: the first of Vaelmoor north of the Gloam Gate, the grey forest where the
 * Sigil-wardens fell in the first war against Vaelor. Their dead never left: knights who still keep
 * their posts, deserters still hanging in the oaks, mourners at the graves and a great weeping tree in
 * the far north-west where their lord waits. Candlewick, in the east by the Bonefields road, keeps a
 * candle in every window, for the dead fear the light. The Drowned Bell Chapel lies south of town, the
 * Wolf Barrow north, the Wardens' Rest in the middle of the wood, the Hanging Oaks west and the
 * Widows' Mere beyond them by the river. East of the Rest, in a fold of the wood, lies Lark's Hollow, the
 * royal lodge where Queen Ysane took her children in the plague winter, frozen in the moment it died.
 *
 * What changes: the wood weeps (gloom) until the Weeping Lord is laid down; Lark's Hollow stays frosted, its
 * bonfire burning and not burning, until the children are brought home, and is only ash after.
 */
export const WEEPING_WOODS = wildRegion(
  {
    id: 'weeping-woods',
    name: 'The Weeping Woods',
    subtitle: 'The restless dead of the old war',
    theme: 'haunted',
    levels: [48, 51],
    at: [54, -26],
    dark: false,
    safe: false,
    music: 'weeping-woods',
    blurb: 'A grey wood of the Dead Kingdom where the Sigil-wardens of the old war still walk, and every window in Candlewick holds a candle.',
    states: [{ id: 'weeping', when: until('the-weeping-lord'), gloom: true }],
  },
  {
    w: 160,
    h: 104,
    seed: 38803,
    levels: [48, 51],
    from: [0.92, 0.6],
    forest: 0.46,
    scatter: { trees: 2.2, bushes: 1.4, rocks: 1, flowers: 0.8 },
    water: { kind: 'river', from: 'n', to: 'w' },
    hubs: [{ at: [0.8, 0.62], plan: 'cross', npcs: ['candlewife-hesper', 'sexton-abel', 'chandler-miro', 'woodward-fenn'], houses: 6 }],
    exits: [
      { side: 's', at: 0.7, to: 'gloamhollow', label: 'South through the Gloam Gate to Lastlight' },
      { side: 'e', at: 0.6, to: 'bonefields', label: 'East road to the Bonefields' },
      { side: 'w', at: 0.7, to: 'blightwood', label: 'West road to the Blightwood', minLevel: 50 },
      { side: 'n', at: 0.55, to: 'hollowmere', label: 'North road to Hollowmere', minLevel: 53 },
      { side: 'n', at: 0.15, to: 'riftscar', label: 'North-west track to the Riftscar Wastes', minLevel: 54 },
    ],
    pois: [
      // the great tree where the Weeping Lord waits, far in the north-west
      {
        at: [0.2, 0.25],
        r: 13,
        kind: 'grove',
        level: 50,
        packs: [
          ['revenant-knight', 'weeping-specter'],
          ['hanged-man', 'hanged-man', 'weeping-specter'],
          ['mourning-willow', 'revenant-knight'],
        ],
        rare: 'the-weeping-lord',
        spot: { id: 'the-weeping-tree', name: 'The Weeping Tree' },
        chest: 'epic',
      },
      // the wardens' old hall, where the Lord's own company still keeps its posts
      {
        at: [0.5, 0.3],
        r: 11,
        kind: 'ruin',
        level: 49,
        packs: [
          ['revenant-knight', 'revenant-knight', 'weeping-specter'],
          ['revenant-knight', 'grave-wolf', 'grave-wolf'],
          ['revenant-knight', 'revenant-knight'],
        ],
        elite: true,
        spot: { id: 'wardens-rest', name: 'The Wardens’ Rest' },
        landmark: { style: 'hall', w: 7, h: 5, name: 'The Wardens’ Rest' },
        chest: 'rare',
      },
      // where the willows drink from the river
      {
        at: [0.32, 0.42],
        r: 9,
        kind: 'grove',
        level: 49,
        packs: [
          ['mourning-willow', 'mourning-willow'],
          ['mourning-willow', 'weeping-specter'],
        ],
        spot: { id: 'widows-mere', name: 'The Widows’ Mere' },
      },
      {
        at: [0.36, 0.64],
        r: 10,
        kind: 'grove',
        level: 49,
        packs: [
          ['hanged-man', 'hanged-man'],
          ['hanged-man', 'hanged-man', 'grave-wolf'],
          ['hanged-man', 'weeping-specter'],
        ],
        spot: { id: 'the-hanging-oaks', name: 'The Hanging Oaks' },
      },
      // the wardens' chapel south of town, where Mother Hush snuffs the candles
      {
        at: [0.6, 0.8],
        r: 10,
        kind: 'ruin',
        level: 49,
        packs: [
          ['candle-wraith', 'candle-wraith', 'weeping-specter'],
          ['weeping-specter', 'candle-wraith'],
        ],
        rare: 'mother-hush',
        spot: { id: 'old-chapel', name: 'The Drowned Bell Chapel' },
        landmark: { style: 'temple', w: 5, h: 4, name: 'The Drowned Bell Chapel' },
        chest: 'common',
      },
      // Lark's Hollow: Queen Ysane's lodge, frozen in the night Vaelmoor died
      { at: [0.62, 0.42], r: 9, kind: 'ruin', level: 49, packs: [['weeping-specter', 'weeping-specter'], ['mourning-willow', 'weeping-specter']], spot: { id: 'larks-hollow', name: 'Lark’s Hollow' }, landmark: { style: 'hall', w: 5, h: 4, name: 'The Queen’s Lodge' }, when: until('wood-the-children') },
      // the wolfhounds' barrow north of town, and the Lord's empty grave
      {
        at: [0.75, 0.22],
        r: 10,
        kind: 'den',
        level: 49,
        packs: [
          ['grave-wolf', 'grave-wolf', 'grave-wolf'],
          ['mourning-willow', 'grave-wolf', 'grave-wolf'],
        ],
        rare: 'old-vigil',
        spot: { id: 'wolf-barrow', name: 'The Wolf Barrow' },
      },
    ],
    wild: [
      { band: [0, 0.4], packs: [['grave-wolf', 'grave-wolf', 'grave-wolf'], ['weeping-specter', 'grave-wolf', 'grave-wolf'], ['candle-wraith', 'grave-wolf', 'grave-wolf'], ['hanged-man', 'weeping-specter'], ['hanged-man', 'hanged-man', 'grave-wolf']] },
      { band: [0.35, 0.7], packs: [['revenant-knight', 'weeping-specter'], ['hanged-man', 'hanged-man', 'grave-wolf'], ['mourning-willow', 'candle-wraith', 'candle-wraith'], ['revenant-knight', 'grave-wolf', 'grave-wolf'], ['mourning-willow', 'hanged-man']] },
      { band: [0.65, 1], packs: [['revenant-knight', 'revenant-knight', 'weeping-specter'], ['mourning-willow', 'hanged-man', 'hanged-man'], ['revenant-knight', 'candle-wraith', 'candle-wraith'], ['mourning-willow', 'weeping-specter', 'grave-wolf']] },
    ],
    wildCount: 56,
    story: [
      // Orren in Candlewick's square, from the day he comes through the Gate
      { near: 'hub', dx: -3, dy: 3, marker: { kind: 'npc', npc: 'orren-in-vaelmoor' }, when: after('the-third-gate') },
      // Lark's Hollow: the queen at the lodge door, the children out in the frozen wood
      { near: 'larks-hollow', dx: 0, dy: 2, marker: { kind: 'npc', npc: 'echo-of-ysane' }, when: until('wood-the-children') },
      { near: 'larks-hollow', dx: 0, dy: 3, marker: { kind: 'place', id: 'hollow-door' } },
      { near: 'larks-hollow', dx: -12, dy: 8, marker: { kind: 'place', id: 'hollow-wood' } },
      { near: 'larks-hollow', dx: -4, dy: -9, marker: { kind: 'place', id: 'hollow-n' } },
      { near: 'larks-hollow', dx: 10, dy: 4, marker: { kind: 'place', id: 'hollow-e' } },
      { near: 'larks-hollow', dx: -6, dy: 14, marker: { kind: 'place', id: 'hollow-s' } },
      { near: 'larks-hollow', dx: 3, dy: 5, marker: { kind: 'prop', prop: 'campfire' }, when: until('wood-the-children') },
      { near: 'larks-hollow', dx: 3, dy: 4, marker: { kind: 'wisp', color: '#c8c4dc', size: 2 }, when: until('wood-the-children') },
      { near: 'larks-hollow', dx: 3, dy: 5, marker: { kind: 'prop', prop: 'debris' }, when: after('wood-the-children') },
      // the Weeping Tree after Edric: his sword under it, and lanterns on the wardens' graves
      { near: 'the-weeping-tree', dx: 0, dy: 3, marker: { kind: 'prop', prop: 'lantern' }, when: after('the-weeping-lord') },
      { near: 'wardens-rest', dx: -3, dy: 4, marker: { kind: 'prop', prop: 'lantern' }, when: after('the-weeping-lord') },
      { near: 'wardens-rest', dx: 3, dy: 4, marker: { kind: 'prop', prop: 'lantern' }, when: after('the-weeping-lord') },
    ],
  },
);
