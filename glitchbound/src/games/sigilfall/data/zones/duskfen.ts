import { wildRegion } from '../zonegen';

/**
 * Duskfen (levels 18-24): the plague swamp west of Greyfen, green water and sick villages. Stilt
 * Hollow, at the end of the causeway, is the last village still breathing on its own. The Rot-Mother,
 * one of the Hollow King's lieutenants, brews the sickness in the old cistern under the south of the
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
    music: 'forest',
    blurb: 'Green water, sick villages and the cistern where the Rot-Mother stirs her pot.',
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
    hubs: [{ at: [0.78, 0.34], npcs: ['healer-osk', 'brother-wendel', 'mags'], houses: 5 }],
    exits: [{ side: 'e', at: 0.5, to: 'greyfen', label: 'East causeway to Greyfen' }],
    pois: [
      // the first village to sicken
      { at: [0.84, 0.7], r: 10, kind: 'ruin', packs: [['plague-ghoul', 'plague-ghoul'], ['plaguebearer', 'plague-ghoul'], ['bloated-corpse', 'plague-ghoul', 'plaguebearer']], chest: 'common', spot: { id: 'low-wick', name: 'Low Wick' } },
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
  },
);
