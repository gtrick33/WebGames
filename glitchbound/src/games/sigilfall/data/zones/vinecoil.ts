import { wildRegion } from '../zonegen';

/**
 * Vinecoil Jungle (39-45): steaming jungle east of Stormwatch and south of the Sunscorch, cut by a
 * brown river. Vinehold is a stockade town of loggers and wardens on the west side, where the roads
 * come in. Panthers hunt the green, blood mosquitoes breed in the Mire Pools and the stranglers root
 * in their grove, and the serpent cult keeps temples older than any kingdom: the Serpent Steps east
 * of town, and the Coiled Temple in the far east, where the cult's high queen sold the Hollow King
 * the venom he brewed into his plague.
 */
export const VINECOIL = wildRegion(
  {
    id: 'vinecoil',
    name: 'Vinecoil Jungle',
    subtitle: 'The old serpent temples',
    theme: 'jungle',
    levels: [39, 45],
    at: [104, 74],
    dark: false,
    safe: false,
    music: 'forest',
    blurb: 'Steaming jungle, panthers and the serpent cult’s temples, older than any kingdom.',
  },
  {
    w: 160,
    h: 110,
    seed: 27719,
    levels: [39, 45],
    from: [0.04, 0.5],
    forest: 0.46,
    scatter: { trees: 2.6, bushes: 2.4, rocks: 0.6, flowers: 4 },
    water: { kind: 'river', from: 'n', to: 's' },
    hubs: [{ at: [0.28, 0.5], npcs: ['warden-kesh', 'trader-mabel', 'shaman-tuoko'], houses: 5 }],
    exits: [
      { side: 'w', at: 0.5, to: 'stormwatch', label: 'West road to Stormwatch' },
      { side: 'n', at: 0.5, to: 'sunscorch', label: 'North road to the Sunscorch' },
    ],
    pois: [
      // the finale: the high queen in her temple, with her guard and her vipers
      { at: [0.84, 0.25], r: 12, kind: 'ruin', level: 44, packs: [['naga-warrior', 'serpent-cultist', 'temple-viper'], ['naga-warrior', 'naga-warrior', 'serpent-cultist'], ['serpent-cultist', 'serpent-cultist', 'temple-viper', 'temple-viper']], elite: true, rare: 'the-coiled-queen', spot: { id: 'coiled-temple', name: 'The Coiled Temple' }, chest: 'rare', landmark: { style: 'temple', w: 6, h: 4, name: 'The Coiled Temple' } },
      { at: [0.6, 0.44], r: 10, kind: 'ruin', level: 42, packs: [['naga-warrior', 'temple-viper', 'temple-viper'], ['naga-warrior', 'serpent-cultist'], ['temple-viper', 'temple-viper', 'serpent-cultist']], spot: { id: 'serpent-steps', name: 'The Serpent Steps' }, chest: 'common' },
      { at: [0.44, 0.18], r: 10, kind: 'camp', level: 40, packs: [['serpent-cultist', 'serpent-cultist', 'jungle-panther'], ['naga-warrior', 'serpent-cultist']], spot: { id: 'cult-camp', name: 'The Cult Camp' }, chest: 'common' },
      { at: [0.68, 0.76], r: 10, kind: 'den', level: 42, packs: [['jungle-panther', 'jungle-panther'], ['jungle-panther', 'jungle-panther', 'jungle-panther']], rare: 'nightpelt', spot: { id: 'panther-falls', name: 'Panther Falls' } },
      { at: [0.44, 0.84], r: 9, kind: 'nest', level: 41, packs: [['blood-mosquito', 'blood-mosquito', 'blood-mosquito'], ['blood-mosquito', 'blood-mosquito', 'blood-mosquito', 'blood-mosquito']], spot: { id: 'mire-pools', name: 'The Mire Pools' } },
      { at: [0.15, 0.8], r: 9, kind: 'grove', level: 40, packs: [['vine-strangler', 'vine-strangler'], ['vine-strangler', 'blood-mosquito', 'blood-mosquito']], spot: { id: 'strangler-grove', name: 'Strangler Grove' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['jungle-panther', 'jungle-panther', 'jungle-panther'], ['blood-mosquito', 'blood-mosquito', 'blood-mosquito', 'blood-mosquito'], ['vine-strangler', 'jungle-panther', 'jungle-panther'], ['serpent-cultist', 'jungle-panther', 'jungle-panther'], ['vine-strangler', 'vine-strangler', 'blood-mosquito', 'blood-mosquito'], ['serpent-cultist', 'serpent-cultist', 'jungle-panther'], ['naga-warrior', 'jungle-panther', 'jungle-panther']] },
      { band: [0.35, 0.7], packs: [['naga-warrior', 'serpent-cultist', 'serpent-cultist'], ['vine-strangler', 'vine-strangler', 'blood-mosquito', 'blood-mosquito'], ['jungle-panther', 'jungle-panther', 'blood-mosquito', 'blood-mosquito'], ['serpent-cultist', 'serpent-cultist', 'temple-viper', 'temple-viper'], ['temple-viper', 'temple-viper', 'jungle-panther', 'jungle-panther']] },
      { band: [0.65, 1], packs: [['naga-warrior', 'naga-warrior', 'serpent-cultist'], ['naga-warrior', 'serpent-cultist', 'temple-viper', 'temple-viper'], ['jungle-panther', 'jungle-panther', 'jungle-panther', 'blood-mosquito'], ['vine-strangler', 'naga-warrior', 'blood-mosquito', 'blood-mosquito']] },
    ],
    wildCount: 56,
  },
);
