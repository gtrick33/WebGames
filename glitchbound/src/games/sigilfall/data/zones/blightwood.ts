import { wildRegion } from '../zonegen';

/**
 * The Blightwood (42-47): north of the Glimmerwood, a forest the Withered Queen has rotted from the
 * root up. Grey trees weep sap, spore-clouds drift between them, and the fey she turned keep her court.
 * Last Leaf, the elves' last village, holds out in the south among the only green left. The Heartroot,
 * a hollow in the oldest tree, goes down to Blightheart, where she keeps the Sigil of Thorns.
 */
export const BLIGHTWOOD = wildRegion(
  {
    id: 'blightwood',
    name: 'The Blightwood',
    subtitle: 'The Withered Queen’s wood',
    theme: 'blight',
    levels: [42, 47],
    at: [28, -8],
    dark: false,
    safe: false,
    music: 'forest',
    blurb: 'A rotting forest of grey trees and spore-clouds, where the Withered Queen keeps her court.',
  },
  {
    w: 160,
    h: 104,
    seed: 41927,
    levels: [42, 47],
    from: [0.5, 0.95],
    forest: 0.42,
    scatter: { trees: 2, bushes: 1.6, rocks: 0.8, flowers: 1.2 },
    water: { kind: 'lakes', amount: 0.35 },
    hubs: [{ at: [0.52, 0.8], npcs: ['elder-thessaly', 'hearthwife-rowan', 'thornsmith-edda'], houses: 5 }],
    exits: [
      { side: 's', at: 0.5, to: 'glimmerwood', label: 'South road to the Glimmerwood' },
      { side: 'w', at: 0.6, to: 'frostfang', label: 'West pass to Frostfang Peaks', minLevel: 43 },
      { side: 'e', at: 0.35, to: 'weeping-woods', label: 'East road to the Weeping Woods', minLevel: 49 },
      { side: 'n', at: 0.3, to: 'riftscar', label: 'North track to the Riftscar Wastes', minLevel: 52 },
    ],
    pois: [
      // the way down to the Queen: a hollow in the oldest tree
      { at: [0.24, 0.2], r: 12, kind: 'cave', level: 46, packs: [['blight-treant', 'blighted-dryad'], ['blight-witch', 'thornling', 'thornling'], ['rotspore-shambler', 'blight-treant']], entrance: { to: 'blightheart', label: 'The Heartroot: down to Blightheart', minLevel: 46 }, spot: { id: 'the-heartroot', name: 'The Heartroot' } },
      { at: [0.7, 0.3], r: 11, kind: 'grove', level: 45, packs: [['blighted-dryad', 'blighted-dryad', 'thornling'], ['blight-witch', 'blight-wolf', 'blight-wolf']], elite: true, rare: 'old-rotbark', spot: { id: 'withered-grove', name: 'The Withered Grove' }, chest: 'rare' },
      { at: [0.3, 0.6], r: 10, kind: 'den', level: 43, packs: [['rotspore-shambler', 'rotspore-shambler'], ['rotspore-shambler', 'blight-wolf', 'blight-wolf']], spot: { id: 'spore-hollow', name: 'Spore Hollow' } },
      { at: [0.78, 0.62], r: 10, kind: 'farm', level: 43, packs: [['blight-wolf', 'blight-wolf', 'blight-wolf'], ['thornling', 'thornling', 'thornling', 'thornling']], spot: { id: 'greenhallow', name: 'Greenhallow Farmstead' }, chest: 'common' },
      { at: [0.48, 0.42], r: 10, kind: 'ruin', level: 44, packs: [['blight-witch', 'blighted-dryad'], ['blight-treant', 'thornling', 'thornling']], spot: { id: 'thorn-shrine', name: 'The Thorn Shrine' }, landmark: { style: 'temple', w: 5, h: 4, name: 'The Thorn Shrine' } },
      { at: [0.88, 0.16], r: 10, kind: 'camp', level: 46, packs: [['legion-soldier', 'legion-soldier', 'legion-crossbowman'], ['legion-bonecaller', 'legion-soldier', 'legion-soldier']], spot: { id: 'legion-woodcamp', name: 'The Legion Woodcamp' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['blight-wolf', 'blight-wolf', 'blight-wolf'], ['thornling', 'thornling', 'thornling', 'thornling'], ['rotspore-shambler', 'blight-wolf'], ['blighted-dryad', 'thornling', 'thornling']] },
      { band: [0.35, 0.7], packs: [['blight-treant', 'thornling', 'thornling'], ['blighted-dryad', 'blighted-dryad', 'blight-wolf'], ['rotspore-shambler', 'rotspore-shambler', 'thornling'], ['blight-witch', 'blight-wolf', 'blight-wolf']] },
      { band: [0.65, 1], packs: [['blight-treant', 'blighted-dryad', 'thornling'], ['blight-witch', 'rotspore-shambler', 'blight-wolf'], ['blight-treant', 'blight-treant'], ['legion-soldier', 'legion-soldier', 'legion-crossbowman']] },
    ],
    wildCount: 56,
  },
);
