import { wildRegion } from '../zonegen';

/**
 * The Weeping Woods (50-55): west of the Bonefields, the forest where the Sigil-wardens fell in the
 * first war against Vaelor. Their dead never left: knights who still keep their posts, hanged deserters,
 * mourning specters and a great weeping tree where their lord waits. Candlewick keeps a candle in every
 * window, for the dead fear the light.
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
    hubs: [{ at: [0.8, 0.62], npcs: ['candlewife-hesper', 'sexton-abel', 'chandler-miro'], houses: 6 }],
    exits: [
      { side: 'e', at: 0.6, to: 'bonefields', label: 'East road to the Bonefields' },
      { side: 'w', at: 0.7, to: 'blightwood', label: 'West road to the Blightwood' },
      { side: 'n', at: 0.55, to: 'gloamhollow', label: 'North road to Gloamhollow', minLevel: 53 },
      { side: 'n', at: 0.15, to: 'riftscar', label: 'North-west track to the Riftscar Wastes', minLevel: 52 },
    ],
    pois: [
      // the great tree where the Weeping Lord waits
      { at: [0.2, 0.25], r: 13, kind: 'grove', level: 55, packs: [['revenant-knight', 'revenant-knight', 'weeping-specter'], ['hanged-man', 'hanged-man', 'weeping-specter'], ['mourning-willow', 'revenant-knight']], rare: 'the-weeping-lord', spot: { id: 'the-weeping-tree', name: 'The Weeping Tree' }, chest: 'epic' },
      { at: [0.5, 0.3], r: 11, kind: 'ruin', level: 53, packs: [['revenant-knight', 'revenant-knight'], ['candle-wraith', 'revenant-knight', 'weeping-specter']], elite: true, rare: 'mother-hush', spot: { id: 'wardens-rest', name: 'The Wardens’ Rest' }, landmark: { style: 'hall', w: 7, h: 5, name: 'The Wardens’ Rest' }, chest: 'rare' },
      { at: [0.36, 0.62], r: 10, kind: 'grove', level: 52, packs: [['hanged-man', 'hanged-man'], ['hanged-man', 'grave-wolf', 'grave-wolf']], spot: { id: 'the-hanging-oaks', name: 'The Hanging Oaks' } },
      { at: [0.6, 0.8], r: 10, kind: 'ruin', level: 51, packs: [['candle-wraith', 'candle-wraith'], ['weeping-specter', 'weeping-specter', 'candle-wraith']], spot: { id: 'old-chapel', name: 'The Drowned Bell Chapel' }, landmark: { style: 'temple', w: 5, h: 4, name: 'The Drowned Bell Chapel' }, chest: 'common' },
      { at: [0.75, 0.22], r: 10, kind: 'den', level: 53, packs: [['grave-wolf', 'grave-wolf', 'grave-wolf'], ['mourning-willow', 'grave-wolf', 'grave-wolf']], spot: { id: 'wolf-barrow', name: 'The Wolf Barrow' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['grave-wolf', 'grave-wolf', 'grave-wolf'], ['weeping-specter', 'weeping-specter'], ['candle-wraith', 'grave-wolf', 'grave-wolf'], ['hanged-man', 'weeping-specter']] },
      { band: [0.35, 0.7], packs: [['revenant-knight', 'weeping-specter'], ['hanged-man', 'hanged-man', 'grave-wolf'], ['mourning-willow', 'candle-wraith'], ['candle-wraith', 'candle-wraith', 'weeping-specter']] },
      { band: [0.65, 1], packs: [['revenant-knight', 'revenant-knight', 'weeping-specter'], ['mourning-willow', 'hanged-man', 'hanged-man'], ['revenant-knight', 'candle-wraith', 'candle-wraith']] },
    ],
    wildCount: 56,
  },
);
