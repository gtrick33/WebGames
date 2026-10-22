import { wildRegion } from '../zonegen';

/**
 * Emberdeep Caldera (51-56): north of the Bonefields, a ring of black mountains around a lake of fire.
 * The Legion has chained the fire lord Ashkar on his own throne beneath it and set him to forging the
 * Pale Crown; their forge-slaves haul ore along the lava flows, and the caldera's fire-folk have gone
 * mad with their lord's pain. The dwarves of Cinderhold, an old fire-ward outpost on the southern rim,
 * still watch.
 */
export const EMBERDEEP = wildRegion(
  {
    id: 'emberdeep',
    name: 'Emberdeep Caldera',
    subtitle: 'Where the Pale Crown is forged',
    theme: 'volcanic',
    levels: [51, 56],
    at: [96, -42],
    dark: false,
    safe: false,
    music: 'cave',
    blurb: 'A ring of black mountains round a lake of fire, where the Legion forges the Pale Crown.',
  },
  {
    w: 160,
    h: 104,
    seed: 91163,
    levels: [51, 56],
    from: [0.4, 0.95],
    forest: 0.3,
    scatter: { trees: 0.6, bushes: 0.4, rocks: 2.4, flowers: 0.4 },
    water: { kind: 'lakes', amount: 0.4 },
    hubs: [{ at: [0.38, 0.82], npcs: ['thane-hroki', 'brewer-asgerd', 'runesmith-dvalin'], houses: 5 }],
    exits: [
      { side: 's', at: 0.4, to: 'bonefields', label: 'South road to the Bonefields' },
      { side: 'w', at: 0.35, to: 'hollowmere', label: 'West road to Hollowmere', minLevel: 55 },
    ],
    pois: [
      // the gate down to Ashkar's throne
      { at: [0.62, 0.22], r: 12, kind: 'cave', level: 55, packs: [['obsidian-golem', 'legion-forgeslave', 'legion-forgeslave'], ['legion-flamecaller', 'magma-hound', 'magma-hound'], ['obsidian-golem', 'legion-flamecaller']], entrance: { to: 'molten-throne', label: 'The Throne’s Gate: down to the Molten Throne', minLevel: 53 }, spot: { id: 'throne-gate', name: 'The Throne’s Gate' } },
      { at: [0.84, 0.48], r: 11, kind: 'nest', level: 54, packs: [['ash-drake', 'cinder-imp', 'cinder-imp'], ['ash-drake', 'magma-hound']], elite: true, rare: 'pyrebrand', spot: { id: 'drake-roost', name: 'The Drake Roost' }, chest: 'rare' },
      { at: [0.2, 0.36], r: 11, kind: 'camp', level: 53, packs: [['legion-forgeslave', 'legion-forgeslave', 'legion-flamecaller'], ['legion-soldier', 'legion-soldier', 'legion-forgeslave']], spot: { id: 'slave-forges', name: 'The Slave Forges' }, landmark: { style: 'smithy', w: 5, h: 4, name: 'The Slave Forges' }, chest: 'common' },
      { at: [0.5, 0.56], r: 10, kind: 'den', level: 52, packs: [['magma-hound', 'magma-hound', 'magma-hound'], ['cinder-imp', 'cinder-imp', 'cinder-imp', 'cinder-imp']], spot: { id: 'magma-runs', name: 'The Magma Runs' } },
      { at: [0.74, 0.8], r: 9, kind: 'ruin', level: 51, packs: [['fire-elemental', 'cinder-imp', 'cinder-imp'], ['fire-elemental', 'fire-elemental']], spot: { id: 'fire-ward', name: 'The Old Fire-Ward' }, landmark: { style: 'tower', w: 4, h: 4, name: 'The Old Fire-Ward' } },
    ],
    wild: [
      { band: [0, 0.4], packs: [['cinder-imp', 'cinder-imp', 'cinder-imp'], ['magma-hound', 'magma-hound'], ['fire-elemental', 'cinder-imp'], ['legion-forgeslave', 'legion-forgeslave', 'legion-soldier']] },
      { band: [0.35, 0.7], packs: [['obsidian-golem', 'cinder-imp', 'cinder-imp'], ['legion-flamecaller', 'legion-forgeslave', 'legion-forgeslave'], ['magma-hound', 'magma-hound', 'fire-elemental'], ['ash-drake', 'cinder-imp']] },
      { band: [0.65, 1], packs: [['obsidian-golem', 'legion-flamecaller'], ['ash-drake', 'magma-hound', 'magma-hound'], ['fire-elemental', 'fire-elemental', 'cinder-imp'], ['legion-flamecaller', 'legion-soldier', 'legion-soldier']] },
    ],
    wildCount: 54,
  },
);
