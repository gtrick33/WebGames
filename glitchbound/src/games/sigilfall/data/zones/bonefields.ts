import { wildRegion } from '../zonegen';

/**
 * The Bonefields (48-53): north of Highwall, an ashen plain where the Hollow Legion musters for its
 * next march. Bone-pits where the dead are dug up and put back together, rows of tents and bone-banners,
 * raided farms and the old ossuary of the Sigil-wardens. At the heart of the muster stands the Bone
 * Colossus. Marshal Ardent holds the Forward Camp in the south, Highwall's first foothold beyond the
 * wall; Haldren's Farm lies west of it and Gallows Hill east, the Bone Pits in the north-west, the
 * Wardens' Ossuary in the north-east and the Muster in the north.
 */
export const BONEFIELDS = wildRegion(
  {
    id: 'bonefields',
    name: 'The Bonefields',
    subtitle: 'Where the Legion musters',
    theme: 'bonefield',
    levels: [48, 53],
    at: [78, -20],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'An ashen plain of bone-pits and Legion tents, where the dead muster for the next march.',
  },
  {
    w: 160,
    h: 104,
    seed: 26681,
    levels: [48, 53],
    from: [0.5, 0.95],
    forest: 0.18,
    scatter: { trees: 0.8, bushes: 0.8, rocks: 2, flowers: 0.6 },
    water: { kind: 'lakes', amount: 0.14 },
    hubs: [{ at: [0.48, 0.84], npcs: ['marshal-ardent', 'cook-brannoc', 'armorer-jessa', 'farmer-haldren'], houses: 5 }],
    exits: [
      { side: 's', at: 0.5, to: 'highwall', label: 'South road to Highwall' },
      { side: 'e', at: 0.6, to: 'sunken-reaches', label: 'East road to the Sunken Reaches' },
      { side: 'w', at: 0.45, to: 'weeping-woods', label: 'West road to the Weeping Woods', minLevel: 49 },
      { side: 'n', at: 0.7, to: 'emberdeep', label: 'North road to Emberdeep Caldera', minLevel: 50 },
    ],
    pois: [
      // the heart of the muster, where the Colossus stands
      {
        at: [0.5, 0.18],
        r: 14,
        kind: 'camp',
        level: 53,
        packs: [
          ['death-knight', 'legion-soldier', 'legion-soldier'],
          ['legion-necromancer', 'bone-giant'],
          ['legion-lancer', 'legion-lancer', 'legion-crossbowman'],
          ['death-knight', 'legion-necromancer'],
        ],
        rare: 'the-bone-colossus',
        spot: { id: 'the-muster', name: 'The Muster' },
        chest: 'epic',
        landmark: { style: 'keep', w: 8, h: 5, name: 'The Muster Hall' },
      },
      // where the dead are dug up and stitched together, and Krogg does the stitching
      {
        at: [0.2, 0.42],
        r: 11,
        kind: 'den',
        level: 50,
        packs: [
          ['abomination', 'carrion-crow', 'carrion-crow'],
          ['legion-necromancer', 'carrion-crow', 'carrion-crow'],
          ['abomination', 'legion-necromancer'],
        ],
        elite: true,
        rare: 'butcher-krogg',
        spot: { id: 'bone-pits', name: 'The Bone Pits' },
        chest: 'rare',
      },
      { at: [0.8, 0.4], r: 10, kind: 'ruin', level: 51, packs: [['death-knight', 'legion-soldier'], ['legion-necromancer', 'legion-soldier', 'legion-soldier'], ['death-knight', 'grave-hound', 'grave-hound']], spot: { id: 'the-ossuary', name: 'The Wardens’ Ossuary' }, landmark: { style: 'temple', w: 5, h: 4, name: 'The Wardens’ Ossuary' } },
      { at: [0.24, 0.74], r: 10, kind: 'farm', level: 48, packs: [['carrion-crow', 'carrion-crow', 'carrion-crow'], ['legion-lancer', 'legion-soldier'], ['grave-hound', 'grave-hound', 'grave-hound']], spot: { id: 'raided-farm', name: 'Haldren’s Farm' }, chest: 'common' },
      { at: [0.74, 0.7], r: 9, kind: 'ruin', level: 49, packs: [['legion-soldier', 'legion-soldier', 'legion-crossbowman'], ['abomination', 'legion-soldier'], ['grave-hound', 'grave-hound', 'legion-crossbowman']], spot: { id: 'gallows-hill', name: 'Gallows Hill' } },
    ],
    wild: [
      {
        band: [0, 0.4],
        packs: [
          ['carrion-crow', 'carrion-crow', 'carrion-crow'],
          ['legion-soldier', 'legion-soldier', 'legion-crossbowman'],
          ['legion-lancer', 'legion-soldier'],
          ['grave-hound', 'grave-hound', 'legion-soldier'],
          ['grave-hound', 'grave-hound', 'grave-hound'],
          ['abomination', 'carrion-crow'],
        ],
      },
      {
        band: [0.35, 0.7],
        packs: [
          ['legion-lancer', 'legion-lancer', 'legion-soldier'],
          ['abomination', 'carrion-crow', 'carrion-crow'],
          ['legion-necromancer', 'legion-soldier', 'legion-soldier'],
          ['death-knight', 'legion-crossbowman'],
          ['grave-hound', 'grave-hound', 'legion-lancer'],
        ],
      },
      {
        band: [0.65, 1],
        packs: [
          ['bone-giant', 'legion-soldier', 'legion-soldier'],
          ['death-knight', 'legion-necromancer', 'legion-soldier'],
          ['legion-lancer', 'legion-lancer', 'legion-crossbowman', 'legion-crossbowman'],
          ['abomination', 'legion-necromancer'],
          ['bone-giant', 'death-knight'],
        ],
      },
    ],
    wildCount: 58,
  },
);
