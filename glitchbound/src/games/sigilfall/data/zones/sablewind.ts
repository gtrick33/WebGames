import { wildRegion } from '../zonegen';

/**
 * Sablewind Canyon (levels 37-43): red canyons north of the Sunscorch, a river cutting through them and
 * the Hollow Legion's wagon road running west along the canyon floor to the siege of Highwall, loaded
 * with bone-steel, blasting powder and the dead. Dustcrown, a mining town on the canyon rim, still
 * stands because the Legion hasn't bothered to take it. Its wagons are counted in at the Supply Depot
 * in the far north-west, where Quartermaster Vane keeps the books; its sappers blast the canyon wider
 * at the Sappers' Cut; the Old Lookout watches the road north-west of town. Raptors hunt Raptor Run to
 * the west, rocs nest on the Roc Eyrie to the north-east, the Broken Wagons lie east of town and the
 * Redrock Mine, where Dustcrown's last shift vanished, south-east.
 */
export const SABLEWIND = wildRegion(
  {
    id: 'sablewind',
    name: 'Sablewind Canyon',
    subtitle: 'The Legion’s supply road',
    theme: 'desert',
    levels: [37, 43],
    at: [100, 22],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Red canyons and the Legion’s wagon road, carrying bone-steel to the siege of Highwall.',
  },
  {
    w: 160,
    h: 104,
    seed: 46651,
    levels: [37, 43],
    from: [0.6, 0.96],
    forest: 0.34,
    scatter: { trees: 0.6, bushes: 0.6, rocks: 2.4, flowers: 0.3 },
    water: { kind: 'river', from: 'n', to: 'e' },
    sand: 'all',
    hubs: [{ at: [0.55, 0.75], npcs: ['foreman-garrick', 'dustcrown-dora', 'scout-ilya'], houses: 5 }],
    exits: [
      { side: 's', at: 0.6, to: 'sunscorch', label: 'South road to the Sunscorch' },
      { side: 'w', at: 0.45, to: 'highwall', label: 'West road to Highwall March', minLevel: 39 },
    ],
    pois: [
      // the end of the road: Vane's depot, with his escort
      {
        at: [0.3, 0.3],
        r: 12,
        kind: 'camp',
        level: 42,
        packs: [
          ['bone-hauler', 'legion-teamster', 'legion-wagon-guard'],
          ['legion-sapper', 'legion-teamster'],
          ['legion-wagon-guard', 'legion-teamster'],
        ],
        elite: true,
        rare: 'quartermaster-vane',
        spot: { id: 'supply-depot', name: 'The Supply Depot' },
        chest: 'rare',
      },
      { at: [0.42, 0.58], r: 9, kind: 'ruin', level: 38, packs: [['legion-teamster', 'legion-wagon-guard'], ['canyon-raptor', 'canyon-raptor']], spot: { id: 'old-lookout', name: 'The Old Lookout' }, landmark: { style: 'tower', w: 3, h: 3, name: 'The Old Lookout' } },
      {
        at: [0.48, 0.3],
        r: 10,
        kind: 'camp',
        level: 40,
        packs: [
          ['legion-sapper', 'legion-sapper', 'legion-teamster'],
          ['legion-sapper', 'legion-wagon-guard'],
          ['bone-hauler', 'legion-sapper'],
        ],
        chest: 'common',
        spot: { id: 'sappers-cut', name: 'The Sappers’ Cut' },
      },
      { at: [0.75, 0.28], r: 10, kind: 'nest', level: 39, packs: [['cliff-roc', 'cliff-roc'], ['cliff-roc'], ['cliff-roc', 'cliff-roc']], spot: { id: 'roc-eyrie', name: 'The Roc Eyrie' } },
      { at: [0.22, 0.68], r: 10, kind: 'den', level: 39, packs: [['canyon-raptor', 'canyon-raptor', 'canyon-raptor'], ['canyon-raptor', 'canyon-raptor']], rare: 'the-red-matriarch', spot: { id: 'raptor-run', name: 'Raptor Run' } },
      { at: [0.8, 0.62], r: 9, kind: 'wreck', packs: [['legion-teamster', 'bone-hauler'], ['legion-sapper', 'legion-teamster']], spot: { id: 'broken-wagons', name: 'The Broken Wagons' }, chest: 'common' },
      { at: [0.86, 0.86], r: 9, kind: 'cave', level: 38, packs: [['legion-teamster', 'legion-teamster'], ['bone-hauler', 'legion-teamster']], spot: { id: 'redrock-mine', name: 'The Redrock Mine' } },
    ],
    wild: [
      {
        band: [0, 0.4],
        packs: [
          ['legion-teamster', 'legion-teamster'],
          ['canyon-raptor', 'canyon-raptor'],
          ['cliff-roc'],
          ['legion-teamster', 'legion-wagon-guard'],
          ['canyon-raptor', 'canyon-raptor', 'canyon-raptor'],
          ['legion-sapper', 'legion-teamster'],
        ],
      },
      {
        band: [0.35, 0.7],
        packs: [
          ['bone-hauler', 'legion-teamster'],
          ['legion-sapper', 'legion-sapper', 'legion-teamster'],
          ['canyon-raptor', 'canyon-raptor', 'canyon-raptor'],
          ['cliff-roc', 'cliff-roc'],
          ['legion-wagon-guard', 'legion-teamster', 'legion-teamster'],
          ['bone-hauler', 'legion-wagon-guard'],
        ],
      },
      {
        band: [0.65, 1],
        packs: [
          ['bone-hauler', 'legion-teamster', 'legion-teamster'],
          ['legion-sapper', 'legion-sapper', 'legion-wagon-guard'],
          ['cliff-roc', 'cliff-roc'],
          ['bone-hauler', 'bone-hauler'],
          ['canyon-raptor', 'canyon-raptor', 'cliff-roc'],
          ['legion-wagon-guard', 'legion-wagon-guard', 'legion-teamster'],
        ],
      },
    ],
    wildCount: 54,
  },
);
