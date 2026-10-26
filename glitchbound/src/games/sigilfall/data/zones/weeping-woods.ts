import { wildRegion } from '../zonegen';

/**
 * The Weeping Woods (50-55), Act IV (see WORLD.md): west of the Bonefields, the grey forest where the
 * Sigil-wardens fell in the first war against Vaelor. Their dead never left: knights who still keep
 * their posts, deserters still hanging in the oaks, mourners at the graves and a great weeping tree in
 * the far north-west where their lord waits. Candlewick, in the east by the Bonefields road, keeps a
 * candle in every window, for the dead fear the light. The Drowned Bell Chapel lies south of town, the
 * Wolf Barrow north, the Wardens' Rest in the middle of the wood, the Hanging Oaks west and the
 * Widows' Mere beyond them by the river.
 */
export const WEEPING_WOODS = wildRegion(
  {
    id: 'weeping-woods',
    name: 'The Weeping Woods',
    subtitle: 'The restless dead of the old war',
    theme: 'haunted',
    levels: [50, 55],
    at: [54, -26],
    dark: false,
    safe: false,
    music: 'forest',
    blurb: 'A grey wood where the Sigil-wardens of the old war still walk, and every window holds a candle.',
  },
  {
    w: 160,
    h: 104,
    seed: 38803,
    levels: [50, 55],
    from: [0.92, 0.6],
    forest: 0.46,
    scatter: { trees: 2.2, bushes: 1.4, rocks: 1, flowers: 0.8 },
    water: { kind: 'river', from: 'n', to: 'w' },
    hubs: [{ at: [0.8, 0.62], npcs: ['candlewife-hesper', 'sexton-abel', 'chandler-miro', 'woodward-fenn'], houses: 6 }],
    exits: [
      { side: 'e', at: 0.6, to: 'bonefields', label: 'East road to the Bonefields' },
      { side: 'w', at: 0.7, to: 'blightwood', label: 'West road to the Blightwood' },
      { side: 'n', at: 0.55, to: 'gloamhollow', label: 'North road to Gloamhollow', minLevel: 53 },
      { side: 'n', at: 0.15, to: 'riftscar', label: 'North-west track to the Riftscar Wastes', minLevel: 52 },
    ],
    pois: [
      // the great tree where the Weeping Lord waits, far in the north-west
      {
        at: [0.2, 0.25],
        r: 13,
        kind: 'grove',
        level: 53,
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
        level: 52,
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
        level: 52,
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
        level: 51,
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
        level: 51,
        packs: [
          ['candle-wraith', 'candle-wraith', 'weeping-specter'],
          ['weeping-specter', 'candle-wraith'],
        ],
        rare: 'mother-hush',
        spot: { id: 'old-chapel', name: 'The Drowned Bell Chapel' },
        landmark: { style: 'temple', w: 5, h: 4, name: 'The Drowned Bell Chapel' },
        chest: 'common',
      },
      // the wolfhounds' barrow north of town, and the Lord's empty grave
      {
        at: [0.75, 0.22],
        r: 10,
        kind: 'den',
        level: 52,
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
  },
);
