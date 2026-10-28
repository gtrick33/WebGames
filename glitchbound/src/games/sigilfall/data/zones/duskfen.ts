import { after, during, not, until } from '../cond';
import { wildRegion } from '../zonegen';

/**
 * Duskfen (levels 18-24): the plague swamp west of Greyfen, green water and sick villages. Stilt
 * Hollow, at the end of the causeway, is the last village still breathing on its own. The Rot-Mother,
 * one of the Hallow King's lieutenants, brews the sickness in the old cistern under the south of the
 * fen; her green sisters carry it to the wells, and what it makes of the villagers walks the reeds.
 */
export const DUSKFEN = wildRegion(
  {
    id: 'duskfen',
    name: 'Duskfen',
    subtitle: 'The plague swamp',
    theme: 'plague',
    levels: [18, 24],
    at: [8, 64],
    dark: false,
    safe: false,
    music: 'duskfen',
    blurb: 'Green water, sick villages and the cistern where the Rot-Mother stirs her pot.',
    // Low Wick's plague houses burn the day the cure is in the water
    states: [{ id: 'low-wick-burns', when: during('low-wick-fires'), burning: true }],
  },
  {
    w: 150,
    h: 104,
    seed: 41887,
    levels: [18, 24],
    from: [0.96, 0.5],
    forest: 0.28,
    scatter: { trees: 1.8, bushes: 2, rocks: 0.4, flowers: 3 },
    water: { kind: 'lakes', amount: 0.55 },
    hubs: [{ at: [0.78, 0.34], npcs: ['healer-osk', 'brother-wendel', 'mags'], houses: 5, when: { 'healer-osk': not(during('low-wick-fires')) } }],
    exits: [{ side: 'e', at: 0.5, to: 'greyfen', label: 'East causeway to Greyfen' }],
    pois: [
      // the first village to sicken
      { at: [0.84, 0.7], r: 10, kind: 'ruin', packs: [['plague-ghoul', 'plague-ghoul'], ['plaguebearer', 'plague-ghoul'], ['bloated-corpse', 'plague-ghoul', 'plaguebearer']], chest: 'common', spot: { id: 'low-wick', name: 'Low Wick' }, when: until('the-rot-mother') },
      // where the plague crows bring what they steal
      { at: [0.55, 0.13], r: 9, kind: 'nest', packs: [['plague-crow', 'plague-crow'], ['plague-crow', 'plague-crow', 'plague-crow']], spot: { id: 'carrion-nest', name: 'Carrion Nest' } },
      // the trolls' wallow, and Bogmaw on his heap of salvage
      { at: [0.55, 0.46], r: 11, kind: 'den', packs: [['swamp-troll'], ['swamp-troll', 'plague-ghoul']], rare: 'bogmaw', spot: { id: 'troll-mire', name: 'Troll Mire' } },
      // where the green sisters gather to fill their jars
      { at: [0.5, 0.64], r: 10, kind: 'grove', packs: [['rot-sister', 'plague-ghoul', 'plague-ghoul'], ['rot-sister', 'plaguebearer'], ['rot-sister', 'bloated-corpse']], spot: { id: 'weeping-wells', name: 'The Weeping Wells' } },
      { at: [0.45, 0.85], r: 9, kind: 'cave', packs: [['plaguebearer', 'bloated-corpse', 'bloated-corpse'], ['rot-sister', 'plague-ghoul']], entrance: { to: 'rotmother-cistern', label: 'The Rotmother’s Cistern', minLevel: 21 }, spot: { id: 'cistern-mouth', name: 'The Cistern Mouth' } },
      // Brother Wendel's chapel, gone green
      { at: [0.2, 0.36], r: 11, kind: 'ruin', packs: [['plague-ghoul', 'plague-ghoul', 'plague-ghoul'], ['plaguebearer', 'plague-ghoul', 'bloated-corpse']], rare: 'gutrot', chest: 'rare', spot: { id: 'rotting-chapel', name: 'The Rotting Chapel' } },
      // the last clean water in the fen
      { at: [0.92, 0.14], r: 8, kind: 'grove', packs: [['plague-crow', 'plague-crow']], spot: { id: 'stillwater', name: 'Stillwater Spring' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['plague-ghoul', 'plague-ghoul'], ['bloated-corpse', 'plague-ghoul'], ['plague-crow', 'plague-crow'], ['plaguebearer', 'plague-ghoul']] },
      { band: [0.35, 1], packs: [['plaguebearer', 'plague-ghoul', 'plague-ghoul'], ['bloated-corpse', 'bloated-corpse', 'plague-ghoul'], ['swamp-troll'], ['rot-sister', 'plague-ghoul', 'plague-ghoul'], ['plague-crow', 'plague-crow', 'plague-crow']] },
    ],
    wildCount: 52,
    story: [
      // the causeway road the refugee wagon takes to Stilt Hollow
      { near: 'exit:greyfen', dx: -2, marker: { kind: 'place', id: 'dusk-causeway' } },
      { near: 'hub', dy: 4, marker: { kind: 'place', id: 'dusk-stilt' } },
      // the refugees camped in Stilt Hollow once they're through, and Nyx waiting for them
      { near: 'hub', dx: -8, dy: 6, marker: { kind: 'prop', prop: 'tent', solid: true }, when: after('the-sick-villages') },
      { near: 'hub', dx: -11, dy: 4, marker: { kind: 'prop', prop: 'tent', solid: true }, when: after('the-sick-villages') },
      { near: 'hub', dx: -9, dy: 3, marker: { kind: 'prop', prop: 'cart', solid: true }, when: after('the-sick-villages') },
      { near: 'hub', dx: -10, dy: 6, marker: { kind: 'prop', prop: 'campfire', solid: true }, when: after('the-sick-villages') },
      { near: 'hub', dx: 5, dy: 5, marker: { kind: 'npc', npc: 'nyx' }, when: during('nyx-joins') },
      // Low Wick: a plague-green haze until the cure, its houses burned after, and its people back under canvas
      { near: 'low-wick', dx: -2, marker: { kind: 'wisp', color: '#a8c84a', size: 2 }, when: until('the-rot-mother') },
      { near: 'low-wick', dx: 3, dy: 2, marker: { kind: 'wisp', color: '#a8c84a', size: 1 }, when: until('the-rot-mother') },
      { near: 'low-wick', dx: -4, dy: -2, marker: { kind: 'fire', size: 3 } },
      { near: 'low-wick', dx: 2, dy: -3, marker: { kind: 'fire', size: 2 } },
      { near: 'low-wick', dx: 4, dy: 1, marker: { kind: 'fire', size: 3 } },
      { near: 'low-wick', dx: -1, dy: 3, marker: { kind: 'npc', npc: 'healer-osk' }, when: during('low-wick-fires') },
      { near: 'low-wick', dx: -3, dy: 4, marker: { kind: 'prop', prop: 'debris' }, when: after('low-wick-fires') },
      { near: 'low-wick', dx: 3, dy: 4, marker: { kind: 'prop', prop: 'tent', solid: true }, when: after('low-wick-fires') },
      { near: 'low-wick', dx: 1, dy: 5, marker: { kind: 'npc', npc: 'low-wick-ada' }, when: after('low-wick-fires') },
    ],
  },
);
