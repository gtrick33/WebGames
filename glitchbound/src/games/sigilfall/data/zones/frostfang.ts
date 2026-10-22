import { wildRegion } from '../zonegen';

/**
 * Frostfang Peaks (44-49): north of Rimeheld, the high passes between granite crags and snowfields.
 * Eagle's Rest, a stone town of eagle-wardens, clings to the southern slopes. Yetis den in the ice caves,
 * the Legion's pathfinders mark a road north below the crags, and above them all Skyrend, the great frost
 * roc, nests in her eyrie on the highest peak.
 */
export const FROSTFANG = wildRegion(
  {
    id: 'frostfang',
    name: 'Frostfang Peaks',
    subtitle: 'The high passes',
    theme: 'peaks',
    levels: [44, 49],
    at: [6, -16],
    dark: false,
    safe: false,
    music: 'plains',
    blurb: 'Granite crags and snowfields on the high passes north, under the frost roc’s eyrie.',
  },
  {
    w: 160,
    h: 104,
    seed: 58331,
    levels: [44, 49],
    from: [0.5, 0.95],
    forest: 0.36,
    scatter: { trees: 1.4, bushes: 0.6, rocks: 2.4, flowers: 0.4 },
    water: { kind: 'river', from: 'n', to: 's' },
    hubs: [{ at: [0.4, 0.82], npcs: ['eagle-warden-brynn', 'old-hask', 'furrier-signe'], houses: 5 }],
    exits: [
      { side: 's', at: 0.5, to: 'rimeheld', label: 'South road to Rimeheld' },
      { side: 'e', at: 0.55, to: 'blightwood', label: 'East pass to the Blightwood' },
    ],
    pois: [
      // Skyrend's eyrie on the highest peak
      { at: [0.5, 0.12], r: 12, kind: 'nest', level: 49, packs: [['ice-harpy', 'ice-harpy', 'ice-harpy'], ['frost-roc-hatchling', 'frost-roc-hatchling']], rare: 'skyrend', spot: { id: 'the-eyrie', name: 'Skyrend’s Eyrie' }, chest: 'rare' },
      { at: [0.2, 0.4], r: 11, kind: 'den', level: 46, packs: [['frostfang-yeti', 'frostfang-yeti'], ['frostfang-yeti', 'snow-stalker']], elite: true, rare: 'old-whitepelt', spot: { id: 'yeti-caves', name: 'The Yeti Caves' } },
      { at: [0.75, 0.45], r: 11, kind: 'camp', level: 47, packs: [['legion-pathfinder', 'legion-pathfinder', 'legion-huscarl'], ['legion-bonecaller', 'legion-huscarl', 'legion-pathfinder']], spot: { id: 'legion-road', name: 'The Legion Road' }, chest: 'common' },
      { at: [0.62, 0.72], r: 9, kind: 'ruin', level: 45, packs: [['rime-wight', 'rime-wight'], ['rime-wight', 'snow-stalker']], spot: { id: 'frozen-watch', name: 'The Frozen Watch' }, landmark: { style: 'tower', w: 4, h: 4, name: 'The Frozen Watch' } },
      { at: [0.85, 0.85], r: 9, kind: 'grove', level: 44, packs: [['snow-stalker', 'snow-stalker'], ['ice-harpy', 'ice-harpy', 'snow-stalker']], spot: { id: 'eagles-shrine', name: 'The Eagles’ Shrine' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['snow-stalker', 'snow-stalker'], ['ice-harpy', 'ice-harpy', 'ice-harpy'], ['frostfang-yeti', 'snow-stalker'], ['rime-wight', 'rime-wight']] },
      { band: [0.35, 0.7], packs: [['frostfang-yeti', 'frostfang-yeti'], ['legion-pathfinder', 'legion-pathfinder', 'legion-huscarl'], ['rime-wight', 'ice-harpy', 'ice-harpy'], ['snow-stalker', 'snow-stalker', 'snow-stalker']] },
      { band: [0.65, 1], packs: [['frost-giant', 'frostfang-yeti'], ['ice-harpy', 'ice-harpy', 'frost-roc-hatchling'], ['legion-bonecaller', 'legion-huscarl', 'legion-pathfinder'], ['frostfang-yeti', 'rime-wight', 'rime-wight']] },
    ],
    wildCount: 54,
  },
);
