import { after, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * The Blightwood (50-54), Act V: north of the Glimmerwood, on the Dead Kingdom's western border, a forest the Withered Queen has rotted from the
 * root up. Grey trees weep sap, spore-clouds drift between them, and the fey she turned keep her court.
 * Last Leaf, the elves' last village, holds out in the south among the only green left. The Heartroot,
 * a hollow in the oldest tree, goes down to Blightheart, where she keeps the Sigil of Thorns.
 *
 * What changes: the wood lies in a grey gloom until the Queen is given her winter; the Thorn Shrine is sung
 * at again once her ladies are driven off; the Host's woodcamp burns when its engines are broken.
 */
export const BLIGHTWOOD = wildRegion(
  {
    id: 'blightwood',
    name: 'The Blightwood',
    subtitle: 'The Withered Queen’s wood',
    theme: 'blight',
    levels: [50, 54],
    at: [28, -8],
    dark: false,
    safe: false,
    music: 'forest',
    states: [{ id: 'withering', when: until('the-withered-queen'), gloom: true }],
    blurb: 'A rotting forest of grey trees and spore-clouds, where the Withered Queen keeps her court.',
  },
  {
    w: 160,
    h: 104,
    seed: 41927,
    levels: [50, 54],
    from: [0.5, 0.95],
    forest: 0.42,
    scatter: { trees: 2, bushes: 1.6, rocks: 0.8, flowers: 1.2 },
    water: { kind: 'lakes', amount: 0.35 },
    hubs: [{ at: [0.52, 0.8], npcs: ['elder-thessaly', 'hearthwife-rowan', 'thornsmith-edda'], houses: 5 }],
    exits: [
      { side: 's', at: 0.5, to: 'glimmerwood', label: 'South road to the Glimmerwood' },
      { side: 'e', at: 0.35, to: 'weeping-woods', label: 'East road to the Weeping Woods' },
      { side: 'n', at: 0.3, to: 'riftscar', label: 'North track to the Riftscar Wastes', minLevel: 54 },
    ],
    pois: [
      // the way down to the Queen: a hollow in the oldest tree
      { at: [0.24, 0.2], r: 12, kind: 'cave', level: 52, packs: [['blight-treant', 'blighted-dryad'], ['blight-witch', 'thornling', 'thornling'], ['rotspore-shambler', 'blight-treant']], entrance: { to: 'blightheart', label: 'The Heartroot: down to Blightheart', minLevel: 46 }, spot: { id: 'the-heartroot', name: 'The Heartroot' } },
      { at: [0.7, 0.3], r: 11, kind: 'grove', level: 52, packs: [['blighted-dryad', 'blighted-dryad', 'thornling'], ['blight-witch', 'blight-wolf', 'blight-wolf']], elite: true, rare: 'old-rotbark', spot: { id: 'withered-grove', name: 'The Withered Grove' }, chest: 'rare' },
      { at: [0.3, 0.6], r: 10, kind: 'den', level: 51, packs: [['rotspore-shambler', 'rotspore-shambler'], ['rotspore-shambler', 'blight-wolf', 'blight-wolf']], spot: { id: 'spore-hollow', name: 'Spore Hollow' } },
      { at: [0.78, 0.62], r: 10, kind: 'farm', level: 51, packs: [['blight-wolf', 'blight-wolf', 'blight-wolf'], ['thornling', 'thornling', 'thornling', 'thornling']], spot: { id: 'greenhallow', name: 'Greenhallow Farmstead' }, chest: 'common' },
      { at: [0.48, 0.42], r: 10, kind: 'ruin', level: 51, packs: [['blight-witch', 'blighted-dryad'], ['blight-treant', 'thornling', 'thornling']], spot: { id: 'thorn-shrine', name: 'The Thorn Shrine' }, landmark: { style: 'temple', w: 5, h: 4, name: 'The Thorn Shrine' } },
      { at: [0.88, 0.16], r: 10, kind: 'camp', level: 52, packs: [['legion-soldier', 'legion-soldier', 'legion-crossbowman'], ['legion-bonecaller', 'legion-soldier', 'legion-soldier'], ['bone-catapult', 'legion-woodsman', 'legion-woodsman'], ['bone-catapult', 'legion-soldier']], spot: { id: 'legion-woodcamp', name: 'The Host Woodcamp' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['blight-wolf', 'blight-wolf', 'blight-wolf'], ['thornling', 'thornling', 'thornling', 'thornling'], ['rotspore-shambler', 'blight-wolf'], ['blighted-dryad', 'thornling', 'thornling']] },
      { band: [0.35, 0.7], packs: [['blight-treant', 'thornling', 'thornling'], ['blighted-dryad', 'blighted-dryad', 'blight-wolf'], ['rotspore-shambler', 'rotspore-shambler', 'thornling'], ['blight-witch', 'blight-wolf', 'blight-wolf']] },
      { band: [0.65, 1], packs: [['blight-treant', 'blighted-dryad', 'thornling'], ['blight-witch', 'rotspore-shambler', 'blight-wolf'], ['blight-treant', 'blight-treant'], ['legion-soldier', 'legion-soldier', 'legion-crossbowman']] },
    ],
    story: [
      // the Thorn Shrine sung at again; the woodcamp burned; Last Leaf green again after the Queen sleeps
      { near: 'thorn-shrine', dx: -2, dy: 3, marker: { kind: 'prop', prop: 'lantern' }, when: after('the-queens-ladies') },
      { near: 'thorn-shrine', dx: 2, dy: 3, marker: { kind: 'prop', prop: 'lantern' }, when: after('the-queens-ladies') },
      { near: 'thorn-shrine', dx: 0, dy: -1, marker: { kind: 'wisp', color: '#b6c88a', size: 2 }, when: until('the-queens-ladies') },
      { near: 'legion-woodcamp', dx: 0, dy: 0, marker: { kind: 'prop', prop: 'skull-banner' }, when: until('engines-of-blight') },
      { near: 'legion-woodcamp', dx: -3, dy: 2, marker: { kind: 'prop', prop: 'debris' }, when: after('engines-of-blight') },
      { near: 'legion-woodcamp', dx: 3, dy: 1, marker: { kind: 'prop', prop: 'rubble' }, when: after('engines-of-blight') },
      { near: 'the-heartroot', dx: 0, dy: 2, marker: { kind: 'wisp', color: '#8a6a7a', size: 3 }, when: until('the-withered-queen') },
      { near: 'hub', dx: 0, dy: -5, marker: { kind: 'prop', prop: 'hay' }, when: after('wolves-at-the-orchard') },
    ],
    wildCount: 56,
  },
);
