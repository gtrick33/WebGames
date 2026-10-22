import { wildRegion } from '../zonegen';

/**
 * Hollowmere (56-60): the dead lake beyond the Gloam Gate, black water so still it mirrors a sky that
 * isn't there. Drowned towns lie under it, the dead walk its shores, and on an island in the middle the
 * Lich of Hollowmere keeps a necropolis where Vaelor's dead are made. The Ferryman, who has rowed the
 * lake longer than anyone remembers, keeps a landing on the southern shore.
 */
export const HOLLOWMERE = wildRegion(
  {
    id: 'hollowmere',
    name: 'Hollowmere',
    subtitle: 'The dead lake',
    theme: 'deadlake',
    levels: [56, 60],
    at: [72, -54],
    dark: false,
    safe: false,
    music: 'crypt',
    blurb: 'A black, still lake with a necropolis on an island in its middle, where the King’s dead are made.',
  },
  {
    w: 160,
    h: 104,
    seed: 82207,
    levels: [56, 60],
    from: [0.3, 0.92],
    forest: 0.22,
    scatter: { trees: 1.2, bushes: 1, rocks: 1.4, flowers: 0.6 },
    water: { kind: 'lakes', amount: 0.7 },
    hubs: [{ at: [0.3, 0.84], npcs: ['the-ferryman', 'old-nan', 'pilgrim-osric'], houses: 4 }],
    exits: [
      { side: 'w', at: 0.6, to: 'gloamhollow', label: 'West causeway to Gloamhollow' },
      { side: 'e', at: 0.7, to: 'emberdeep', label: 'East road to Emberdeep Caldera' },
      { side: 'n', at: 0.5, to: 'pale-reach', label: 'North road to the Pale Reach', minLevel: 56 },
    ],
    pois: [
      // the necropolis on the water
      { at: [0.6, 0.3], r: 14, kind: 'ruin', level: 60, packs: [['necropolis-guard', 'necropolis-guard', 'lich-acolyte'], ['bone-weaver', 'necropolis-guard'], ['lich-acolyte', 'lich-acolyte', 'drowned-dead']], rare: 'the-lich-of-hollowmere', spot: { id: 'the-necropolis', name: 'The Necropolis' }, landmark: { style: 'temple', w: 8, h: 6, name: 'The Necropolis' }, chest: 'epic' },
      { at: [0.18, 0.4], r: 11, kind: 'ruin', level: 57, packs: [['drowned-dead', 'drowned-dead', 'lake-wraith'], ['mere-serpent', 'drowned-dead']], elite: true, rare: 'the-bell-ringer', spot: { id: 'drowned-town', name: 'Drowned Elsmere' }, landmark: { style: 'tower', w: 4, h: 5, name: 'Elsmere Bell Tower' }, chest: 'rare' },
      { at: [0.84, 0.5], r: 10, kind: 'camp', level: 58, packs: [['bone-weaver', 'necropolis-guard'], ['lich-acolyte', 'necropolis-guard', 'necropolis-guard']], spot: { id: 'corpse-landing', name: 'The Corpse Landing' } },
      { at: [0.5, 0.72], r: 10, kind: 'nest', level: 57, packs: [['mere-serpent', 'mere-serpent'], ['lake-wraith', 'lake-wraith', 'mere-serpent']], spot: { id: 'serpent-shallows', name: 'The Serpent Shallows' }, chest: 'common' },
      { at: [0.76, 0.84], r: 9, kind: 'grove', level: 56, packs: [['lake-wraith', 'lake-wraith'], ['drowned-dead', 'drowned-dead', 'drowned-dead']], spot: { id: 'mourners-shore', name: 'Mourners’ Shore' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['drowned-dead', 'drowned-dead', 'drowned-dead'], ['lake-wraith', 'lake-wraith'], ['mere-serpent', 'drowned-dead'], ['lake-wraith', 'drowned-dead', 'drowned-dead']] },
      { band: [0.35, 0.7], packs: [['necropolis-guard', 'drowned-dead', 'drowned-dead'], ['lich-acolyte', 'lake-wraith'], ['mere-serpent', 'mere-serpent'], ['bone-weaver', 'drowned-dead', 'drowned-dead']] },
      { band: [0.65, 1], packs: [['necropolis-guard', 'necropolis-guard', 'lich-acolyte'], ['bone-weaver', 'necropolis-guard'], ['lich-acolyte', 'lich-acolyte', 'lake-wraith'], ['mere-serpent', 'necropolis-guard']] },
    ],
    wildCount: 52,
  },
);
