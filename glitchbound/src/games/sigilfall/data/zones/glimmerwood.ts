import { wildRegion } from '../zonegen';

/**
 * The Glimmerwood (31-37): a wood of light and wonder west of the Grimward Moors, teal grass under a
 * blue canopy, glowing mushrooms, moths that carry their own light. It is going sour. The Withered
 * Queen sends her blight down from the Blightwood in the north, and where it touches, songs turn to
 * thorns: the Summer Court's sprites are thornlings now, its dryads heal the wrong side, its knights
 * ride for Prince Thistlemourn's Thorn Court. Lumen Glade, under Lady Silvaine, is the last bright
 * court. The blight thickens westward, from the Moonwell and Bloomrot Hollow near the glade to the
 * Withered Ring, the Pale Pavilion and the Thorn Court in the far west.
 */
export const GLIMMERWOOD = wildRegion(
  {
    id: 'glimmerwood',
    name: 'The Glimmerwood',
    subtitle: 'The fey courts gone sour',
    theme: 'fey',
    levels: [31, 37],
    at: [30, 24],
    dark: false,
    safe: false,
    music: 'forest',
    blurb: 'A wood of light and wonder, going sour: the fey courts have turned, and thorns grow where songs were.',
  },
  {
    w: 150,
    h: 108,
    seed: 71933,
    levels: [31, 37],
    from: [0.96, 0.5],
    forest: 0.4,
    scatter: { trees: 2.4, bushes: 2, rocks: 0.6, flowers: 6 },
    water: { kind: 'river', from: 'n', to: 's' },
    hubs: [{ at: [0.7, 0.5], npcs: ['lady-silvaine', 'pip-thistledown', 'old-root'], houses: 4 }],
    exits: [
      { side: 'e', at: 0.5, to: 'grimward', label: 'East road to the Grimward Moors' },
      { side: 'w', at: 0.4, to: 'rimeheld', label: 'West road to Rimeheld', minLevel: 32 },
    ],
    pois: [
      // the chain's end: the Prince holds his thorned court in the old Summer Hall
      { at: [0.25, 0.3], r: 11, kind: 'ruin', level: 36, packs: [['fey-knight', 'thorn-archer', 'thornling'], ['blighted-dryad', 'fey-knight', 'thornling'], ['thorn-archer', 'thorn-archer', 'thornling']], elite: true, rare: 'prince-thistlemourn', spot: { id: 'thorn-court', name: 'The Thorn Court' }, chest: 'rare' },
      { at: [0.4, 0.7], r: 10, kind: 'grove', level: 33, packs: [['blighted-dryad', 'thornling', 'thornling'], ['blight-bloom', 'blight-bloom', 'thornling']], spot: { id: 'withered-ring', name: 'The Withered Ring' } },
      { at: [0.6, 0.2], r: 9, kind: 'nest', level: 34, packs: [['glimmer-moth', 'glimmer-moth'], ['glimmer-moth', 'glimmer-moth', 'glimmer-moth']], rare: 'mother-of-moths', spot: { id: 'moth-glade', name: 'Moth Glade' } },
      { at: [0.15, 0.75], r: 10, kind: 'camp', level: 35, packs: [['fey-knight', 'fey-knight'], ['thorn-archer', 'fey-knight', 'thornling'], ['thorn-archer', 'thorn-archer']], elite: true, spot: { id: 'pale-pavilion', name: 'The Pale Pavilion' }, chest: 'common' },
      { at: [0.88, 0.18], r: 9, kind: 'ruin', level: 32, packs: [['glimmer-moth', 'thornling'], ['blighted-dryad', 'thornling']], spot: { id: 'moonwell', name: 'The Moonwell' }, chest: 'common' },
      { at: [0.86, 0.84], r: 9, kind: 'den', level: 32, packs: [['blight-bloom', 'blight-bloom', 'thornling'], ['blight-bloom', 'thornling', 'thornling']], spot: { id: 'bloomrot-hollow', name: 'Bloomrot Hollow' } },
      { at: [0.42, 0.12], r: 10, kind: 'grove', level: 35, packs: [['blighted-stag', 'blighted-stag'], ['blighted-stag', 'thornling', 'thornling']], rare: 'the-pale-hart', spot: { id: 'harts-dell', name: 'The Hart’s Dell' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['thornling', 'thornling', 'thornling'], ['glimmer-moth', 'glimmer-moth', 'thornling'], ['blighted-dryad', 'thornling', 'thornling'], ['blighted-stag', 'thornling', 'thornling'], ['blight-bloom', 'blight-bloom', 'thornling'], ['thorn-archer', 'thornling', 'thornling']] },
      { band: [0.35, 0.7], packs: [['fey-knight', 'thornling', 'thornling'], ['thorn-archer', 'thornling', 'thornling'], ['blighted-dryad', 'blighted-stag'], ['glimmer-moth', 'glimmer-moth', 'glimmer-moth'], ['blight-bloom', 'thornling', 'thornling']] },
      { band: [0.65, 1], packs: [['fey-knight', 'thorn-archer', 'thornling'], ['fey-knight', 'blighted-dryad', 'thorn-archer'], ['thorn-archer', 'thorn-archer', 'fey-knight'], ['blighted-stag', 'blighted-stag', 'thornling'], ['glimmer-moth', 'glimmer-moth', 'thorn-archer']] },
    ],
    wildCount: 56,
  },
);
