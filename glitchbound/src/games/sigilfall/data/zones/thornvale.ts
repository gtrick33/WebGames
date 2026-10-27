import { after, all, during, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * Thornvale (levels 8-14): farmland and hills south of Briarhollow. Wolves raid the farms, spiders hold
 * the woods to the north-east, and the Gallows Gang has taken the old watchtower and dug in under
 * Gallows Hill. Millbrook is the village in the middle of it all.
 */
export const THORNVALE = wildRegion(
  {
    id: 'thornvale',
    name: 'Thornvale',
    subtitle: 'Farmland under the Gallows Gang',
    theme: 'farm',
    levels: [8, 14],
    at: [40, 79],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Farms, wolf hills, spider woods and a bandit gang dug in under Gallows Hill. Millbrook needs help.',
    states: [
      // the night the blockade at the mill burns, and the morning after
      { id: 'mill-burning', when: all(after('mill-the-bridge'), until('camp-grain')), burning: true },
    ],
  },
  {
    w: 150,
    h: 110,
    seed: 81731,
    levels: [8, 14],
    from: [0.36, 0.04],
    forest: 0.3,
    scatter: { trees: 2, bushes: 1.4, rocks: 0.6, flowers: 6 },
    water: { kind: 'lakes', amount: 0.3 },
    hubs: [{ at: [0.38, 0.3], npcs: ['reeve-aldous', 'hanna', 'tobin', 'sefa', 'pim'], houses: 6 }],
    exits: [
      { side: 'n', at: 0.36, to: 'briarhollow', label: 'North road to Briarhollow' },
      { side: 'e', at: 0.58, to: 'saltmarsh', label: 'The coast road', minLevel: 13 },
      { side: 'w', at: 0.62, to: 'greyfen', label: 'West road to Greyfen', minLevel: 11 },
    ],
    pois: [
      { at: [0.18, 0.47], r: 9, kind: 'farm', packs: [['hill-wolf', 'hill-wolf'], ['hill-wolf', 'hill-wolf', 'hill-wolf']], spot: { id: 'tobins-farm', name: 'Tobin’s Farm' } },
      { at: [0.14, 0.78], r: 10, kind: 'den', packs: [['hill-wolf', 'hill-wolf', 'hill-wolf'], ['hill-wolf', 'hill-wolf']], rare: 'old-greymane', spot: { id: 'wolfrun', name: 'Wolfrun Hills' } },
      { at: [0.62, 0.5], r: 11, kind: 'camp', packs: [['bandit-cutthroat', 'bandit-archer', 'bandit-cutthroat'], ['hedge-witch', 'bandit-enforcer'], ['bandit-archer', 'bandit-archer']], elite: true, chest: 'common', spot: { id: 'bandit-camp', name: 'Redcap Camp' } },
      { at: [0.8, 0.22], r: 10, kind: 'nest', packs: [['thornback-spider', 'thornback-spider'], ['thornback-spider', 'thornback-spider', 'thornback-spider']], spot: { id: 'webwood', name: 'Webwood Hollow' } },
      { at: [0.52, 0.82], r: 10, kind: 'ruin', packs: [['bandit-cutthroat', 'bandit-enforcer'], ['bandit-archer', 'hedge-witch', 'bandit-cutthroat']], rare: 'black-bess', chest: 'rare', spot: { id: 'old-watchtower', name: 'The Old Watchtower' } },
      { at: [0.84, 0.8], r: 8, kind: 'cave', packs: [['bandit-enforcer', 'bandit-archer']], entrance: { to: 'gallows-keep', label: 'Gallows Keep', minLevel: 12 }, spot: { id: 'thornvale-gallows-hill', name: 'Gallows Hill' } },
      // the mill on Miller's Pond: the gang's hired blades hold it and tax every cart, until the hero breaks them
      { at: [0.36, 0.64], r: 8, kind: 'grove', packs: [['bandit-cutthroat', 'bandit-archer'], ['bandit-enforcer', 'bandit-cutthroat']], spot: { id: 'millers-pond', name: 'Miller’s Pond' }, when: until('mill-the-bridge') },
      { at: [0.6, 0.15], r: 8, kind: 'farm', packs: [['bandit-cutthroat', 'bandit-cutthroat']], spot: { id: 'east-farm', name: 'Burnt Farm' } },
    ],
    wild: [
      { band: [0, 0.35], packs: [['hill-wolf', 'hill-wolf'], ['hill-wolf', 'hill-wolf', 'hill-wolf'], ['thornback-spider', 'thornback-spider']] },
      { band: [0.3, 0.7], packs: [['bandit-cutthroat', 'bandit-archer'], ['hill-wolf', 'hill-wolf', 'hill-wolf'], ['thornback-spider', 'thornback-spider', 'thornback-spider']] },
      { band: [0.6, 1], packs: [['bandit-cutthroat', 'bandit-cutthroat', 'bandit-archer'], ['bandit-enforcer', 'bandit-archer'], ['hedge-witch', 'bandit-cutthroat', 'bandit-cutthroat']] },
    ],
    wildCount: 55,
    story: [
      // the mill and the gang's barricade across its road
      { near: 'millers-pond', dx: 4, dy: -3, marker: { kind: 'prop', prop: 'windmill', solid: true } },
      { near: 'millers-pond', marker: { kind: 'place', id: 'mill-pond' } },
      { near: 'millers-pond', dy: -9, marker: { kind: 'place', id: 'mill-north' } },
      { near: 'millers-pond', dx: 9, dy: 2, marker: { kind: 'place', id: 'mill-east' } },
      { near: 'millers-pond', dx: -8, dy: 3, marker: { kind: 'place', id: 'mill-west' } },
      { near: 'millers-pond', dx: -2, dy: -4, marker: { kind: 'prop', prop: 'debris' }, when: until('camp-grain') },
      { near: 'millers-pond', dx: 0, dy: -4, marker: { kind: 'prop', prop: 'debris' }, when: until('camp-grain') },
      { near: 'millers-pond', dx: 2, dy: -4, marker: { kind: 'prop', prop: 'crate', solid: true }, when: until('mill-the-bridge') },
      { near: 'millers-pond', dx: -3, dy: -5, marker: { kind: 'prop', prop: 'red-banner' }, when: until('mill-the-bridge') },
      { near: 'millers-pond', dx: 3, dy: -5, marker: { kind: 'prop', prop: 'danger-sign' }, when: until('mill-the-bridge') },
      { near: 'millers-pond', dx: -1, dy: -4, marker: { kind: 'fire', size: 3 } },
      { near: 'millers-pond', dx: 1, dy: -4, marker: { kind: 'fire', size: 2 } },
      // carts waiting to go north once the mill road is free
      { near: 'hub', dx: -3, dy: -7, marker: { kind: 'prop', prop: 'cart', solid: true }, when: until('camp-grain') },
      { near: 'hub', dx: -5, dy: -8, marker: { kind: 'prop', prop: 'hay', solid: true }, when: until('camp-grain') },
      // Nyx, passing through: she reads the gang's cipher for Pim, for a fee
      { near: 'hub', dx: 5, dy: 3, marker: { kind: 'npc', npc: 'nyx' }, when: during('thieves-cant') },
    ],
  },
);
