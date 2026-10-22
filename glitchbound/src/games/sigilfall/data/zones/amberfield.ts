import { wildRegion } from '../zonegen';

/**
 * The Amberfield Steppes (levels 16-22): rolling grass north of the Saltmarsh, all the way to the sky.
 * Hearthstead, a camp town of refugees fleeing the east, sits by the south road. The centaur clans
 * hold the Clan Stones to the east, lions hunt the long grass, and the Hollow Legion's first riders
 * scout the roads from a picket on the north road, where it climbs toward Ironpeak.
 */
export const AMBERFIELD = wildRegion(
  {
    id: 'amberfield',
    name: 'The Amberfield Steppes',
    subtitle: 'Grass to the sky, and refugees on every road',
    theme: 'plains',
    levels: [16, 22],
    at: [72, 66],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Rolling plains, centaur clans, lions in the long grass, and the first riders of the Hollow Legion.',
  },
  {
    w: 170,
    h: 104,
    seed: 61129,
    levels: [16, 22],
    from: [0.5, 0.96],
    forest: 0.07,
    scatter: { trees: 0.6, bushes: 1.1, rocks: 0.9, flowers: 7 },
    water: { kind: 'river', from: 'n', to: 'e' },
    hubs: [{ at: [0.4, 0.7], npcs: ['marshal-dunmore', 'tess-hearthkeeper', 'old-gaius', 'wynn'], houses: 7 }],
    exits: [
      { side: 's', at: 0.5, to: 'saltmarsh', label: 'South road to the Saltmarsh' },
      { side: 'n', at: 0.4, to: 'ironpeak', label: 'North road to Ironpeak', minLevel: 19 },
      { side: 'e', at: 0.55, to: 'stormwatch', label: 'East road to Stormwatch', minLevel: 25 },
    ],
    pois: [
      // a refugee wagon train the Legion caught on the east road
      { at: [0.62, 0.82], r: 10, kind: 'camp', packs: [['legion-scout', 'grave-hound'], ['grave-hound', 'grave-hound']], chest: 'common', spot: { id: 'broken-caravan', name: 'The Broken Caravan' } },
      // the centaurs' war camp, where the clans meet and their war-chief holds the circle
      { at: [0.8, 0.52], r: 12, kind: 'camp', packs: [['centaur-outrider', 'centaur-warbringer', 'centaur-outrider'], ['centaur-warbringer', 'centaur-outrider'], ['centaur-outrider', 'centaur-outrider']], elite: true, rare: 'stormhoof', chest: 'common', spot: { id: 'clan-stones', name: 'The Clan Stones' } },
      // the Legion's picket on the north road, under Rider-Captain Vosk
      { at: [0.52, 0.14], r: 12, kind: 'camp', packs: [['legion-scout', 'legion-scout', 'grave-hound'], ['legion-scout', 'grave-hound', 'grave-hound'], ['legion-scout', 'legion-scout']], elite: true, rare: 'captain-vosk', chest: 'rare', spot: { id: 'legion-picket', name: 'The Legion Picket' } },
      // the pride's rocks
      { at: [0.12, 0.6], r: 10, kind: 'den', packs: [['plains-lion', 'plains-lion'], ['plains-lion']], rare: 'goldmane', spot: { id: 'lion-rocks', name: 'Lion Rocks' } },
      // Wil Ashby's farm, out where nobody else would farm
      { at: [0.26, 0.86], r: 9, kind: 'farm', packs: [['plains-lion', 'plains-lion'], ['hill-wolf', 'hill-wolf', 'hill-wolf']], spot: { id: 'ashby-farm', name: 'Ashby Farm' } },
      // the old graves of the Amber Lancers, dug open from below
      { at: [0.36, 0.3], r: 10, kind: 'ruin', packs: [['legion-scout', 'legion-scout'], ['grave-hound', 'grave-hound', 'legion-scout']], chest: 'rare', spot: { id: 'lancers-rest', name: 'Lancers’ Rest' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['plains-lion', 'plains-lion'], ['centaur-outrider', 'centaur-outrider'], ['hill-wolf', 'hill-wolf', 'hill-wolf'], ['legion-scout', 'grave-hound']] },
      { band: [0.35, 1], packs: [['centaur-warbringer', 'centaur-outrider'], ['legion-scout', 'legion-scout', 'grave-hound'], ['plains-lion', 'plains-lion', 'plains-lion'], ['centaur-outrider', 'centaur-outrider', 'centaur-outrider'], ['grave-hound', 'grave-hound', 'grave-hound']] },
    ],
    wildCount: 58,
  },
);
