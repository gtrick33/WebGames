import { wildRegion } from '../zonegen';

/**
 * Rimeheld Tundra (33-39): the frozen north-west, west of the Glimmerwood. Snow, frozen lakes, snowy
 * pines, and the hardy town of Frostgate under Jarl Sigrun. The Sigil of Frost sleeps in a vault the
 * Sigil-wardens sealed under the ice, and the Legion has come for it: dead northmen raised out of the
 * old battlefields walk the sledge roads, and Jarl Hrimfang of the frost giants has sold them the vault
 * for Hollow gold. His giants keep the Giants' Hearth; the Legion digs at the Vault Door in the far
 * west, near the Frozen Shrine where the wardens' runes are being written over in frost. Wolves and
 * yetis are bolder than they have ever been.
 */
export const RIMEHELD = wildRegion(
  {
    id: 'rimeheld',
    name: 'Rimeheld Tundra',
    subtitle: 'The frozen north-west',
    theme: 'snow',
    levels: [33, 39],
    at: [10, 14],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Snow, frost giants and the old vault where the Sigil of Frost sleeps under the ice.',
  },
  {
    w: 160,
    h: 104,
    seed: 18843,
    levels: [33, 39],
    from: [0.78, 0.52],
    forest: 0.28,
    scatter: { trees: 1.6, bushes: 0.6, rocks: 2, flowers: 0.5 },
    water: { kind: 'lakes', amount: 0.4 },
    hubs: [{ at: [0.72, 0.55], npcs: ['jarl-sigrun', 'brewer-olav', 'runecarver-hild', 'huntress-ylva'], houses: 5 }],
    exits: [
      { side: 'e', at: 0.5, to: 'glimmerwood', label: 'East road to the Glimmerwood' },
      { side: 'n', at: 0.45, to: 'frostfang', label: 'North pass to Frostfang Peaks', minLevel: 43 },
    ],
    pois: [
      // the way down: the Legion and Hrimfang's giants have broken the wardens' seal
      { at: [0.2, 0.3], r: 11, kind: 'cave', level: 38, packs: [['frost-giant', 'legion-huscarl'], ['rime-wraith', 'legion-spearman', 'legion-huscarl']], entrance: { to: 'rimeheld-vault', label: 'The Rimeheld Vault', minLevel: 37 }, spot: { id: 'vault-door', name: 'The Vault Door' } },
      { at: [0.45, 0.75], r: 11, kind: 'den', level: 36, packs: [['ice-wolf', 'ice-wolf', 'ice-wolf'], ['ice-wolf', 'ice-wolf']], rare: 'old-whitefang', spot: { id: 'whitefang-den', name: 'Whitefang’s Den' } },
      { at: [0.5, 0.25], r: 10, kind: 'camp', level: 36, packs: [['frost-giant', 'legion-huscarl'], ['frost-giant', 'ice-wolf'], ['legion-spearman', 'legion-huscarl']], elite: true, spot: { id: 'giants-hearth', name: 'The Giants’ Hearth' }, chest: 'rare' },
      { at: [0.25, 0.65], r: 9, kind: 'ruin', level: 37, packs: [['rime-wraith', 'rime-wraith'], ['rime-wraith', 'legion-huscarl']], spot: { id: 'frozen-shrine', name: 'The Frozen Shrine' }, chest: 'common' },
      { at: [0.88, 0.2], r: 10, kind: 'camp', level: 34, packs: [['legion-huscarl', 'legion-huscarl'], ['legion-spearman', 'legion-huscarl']], spot: { id: 'sledge-camp', name: 'The Sledge Camp' }, chest: 'common' },
      { at: [0.88, 0.86], r: 10, kind: 'den', level: 35, packs: [['yeti'], ['yeti', 'ice-wolf']], rare: 'grumbleback', spot: { id: 'yeti-hollow', name: 'Yeti Hollow' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['ice-wolf', 'ice-wolf', 'ice-wolf'], ['yeti'], ['legion-huscarl', 'legion-spearman'], ['ice-wolf', 'ice-wolf', 'yeti'], ['rime-wraith', 'ice-wolf', 'ice-wolf']] },
      { band: [0.35, 0.7], packs: [['legion-huscarl', 'legion-huscarl', 'legion-spearman'], ['frost-giant', 'ice-wolf'], ['yeti', 'yeti'], ['rime-wraith', 'rime-wraith', 'ice-wolf'], ['ice-wolf', 'ice-wolf', 'ice-wolf', 'ice-wolf']] },
      { band: [0.65, 1], packs: [['frost-giant', 'legion-huscarl', 'legion-spearman'], ['frost-giant', 'frost-giant'], ['rime-wraith', 'rime-wraith', 'legion-huscarl'], ['yeti', 'yeti', 'ice-wolf'], ['legion-spearman', 'legion-spearman', 'legion-huscarl']] },
    ],
    wildCount: 56,
  },
);
